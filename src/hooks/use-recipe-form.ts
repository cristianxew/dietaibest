"use client";

import { createContext, useContext, useEffect, useCallback, useState } from "react";
import {
  useForm,
  useFieldArray,
  useWatch,
  type UseFormReturn,
  type FieldArrayWithId,
  type UseFieldArrayAppend,
  type UseFieldArrayRemove,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { recipeFormSchema, type RecipeFormData } from "@/types/recipe";
import { persistRecipe, updateRecipe, getCategories } from "@/actions/recipe";
import { analyzeRecipeProfileForFormAction } from "@/actions/nutrition";
import type { Profile } from "@/lib/fdc";
import { ingredientsToNutritionLines } from "@/lib/recipe-utils";
import { toast } from "sonner";

type RecipeCategory = { id: string; name: string; slug: string };

export interface RecipeFormCtx {
  form: UseFormReturn<RecipeFormData>;
  ingredientFields: {
    fields: FieldArrayWithId<RecipeFormData, "ingredients">[];
    append: UseFieldArrayAppend<RecipeFormData, "ingredients">;
    remove: UseFieldArrayRemove;
  };
  instructionFields: {
    fields: string[];
    append: (value: string) => void;
    remove: (index: number) => void;
  };
  categories: RecipeCategory[];
  nutritionLoading: boolean;
  nutritionResult: Profile | null;
  isSubmitting: boolean;
  savedRecipeId: string | null;
  analyzeNutrition: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  resetForm: () => void;
}

const DEFAULT_VALUES: RecipeFormData = {
  title: "",
  description: "",
  imageUrl: "",
  servings: 1,
  ingredients: [{ name: "", amount: 1, unit: "" }],
  instructions: [""],
  tags: [],
  categoryIds: [],
  isPublic: false,
};

const RecipeFormContext = createContext<RecipeFormCtx | null>(null);

export function useRecipeForm(): RecipeFormCtx {
  const ctx = useContext(RecipeFormContext);
  if (!ctx) throw new Error("useRecipeForm must be used within RecipeModalProvider");
  return ctx;
}

export { RecipeFormContext };

export function useRecipeFormState(opts: {
  mode: "create" | "edit";
  recipeId: string | null;
  isOpen: boolean;
  onSubmitSuccess: () => void;
}): RecipeFormCtx {
  const { mode, recipeId, isOpen, onSubmitSuccess } = opts;

  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionResult, setNutritionResult] = useState<Profile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);

  const form = useForm<RecipeFormData>({
    // zodResolver infers z.input<Schema> (pre-transform) for TFieldValues, but our form
    // is typed as RecipeFormData (z.infer, post-transform). The cast aligns them — safe
    // because DEFAULT_VALUES always satisfies both types at runtime.
    resolver: zodResolver(recipeFormSchema) as Resolver<RecipeFormData>,
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: ingredientFieldsArr, append: appendIngredient, remove: removeIngredient } =
    useFieldArray({ control: form.control, name: "ingredients" });

  const instructionValues = useWatch({ control: form.control, name: "instructions" }) ?? [""];

  const appendInstruction = useCallback((value: string) => {
    const current = form.getValues("instructions") ?? [];
    form.setValue("instructions", [...current, value], { shouldValidate: true });
  }, [form]);

  const removeInstruction = useCallback((index: number) => {
    const current = form.getValues("instructions") ?? [];
    form.setValue(
      "instructions",
      current.filter((_, i) => i !== index),
      { shouldValidate: true },
    );
  }, [form]);

  useEffect(() => {
    if (!isOpen) return;
    getCategories().then(({ data }) => {
      if (data) setCategories(data);
    });
  }, [isOpen]);

  const resetForm = useCallback(() => {
    form.reset(DEFAULT_VALUES);
    setNutritionResult(null);
    setSavedRecipeId(null);
  }, [form]);

  const analyzeNutrition = useCallback(async () => {
    const { ingredients, servings } = form.getValues();
    const lines = ingredientsToNutritionLines(ingredients);
    if (!lines.length) {
      toast.error("Add ingredients before analyzing nutrition");
      return;
    }
    setNutritionLoading(true);
    try {
      const result = await analyzeRecipeProfileForFormAction({
        ingredients: lines,
        servings,
      });
      if (result.success && result.data) {
        setNutritionResult(result.data);
        // FDC returns the full per-serving profile; pre-fill every macro/micro
        const profile = result.data;
        (Object.keys(profile) as Array<keyof typeof profile>).forEach((key) => {
          form.setValue(key, Math.round(profile[key] * 10) / 10);
        });
      } else {
        toast.error(result.error || "Failed to analyze nutrition");
      }
    } catch {
      toast.error("Nutrition analysis failed");
    } finally {
      setNutritionLoading(false);
    }
  }, [form]);

  const handleSubmit = useCallback(async () => {
    const valid = await form.trigger();
    if (!valid) return;

    setIsSubmitting(true);
    try {
      const data = form.getValues();
      if (mode === "create") {
        const source = data.sourceUrl
          ? (data.sourceUrl.startsWith("http") ? "url" : "imported")
          : "manual";
        const result = await persistRecipe(data, { source });
        if (result.error || !result.data) {
          toast.error((result.error as string) || "Failed to save recipe");
          return;
        }
        setSavedRecipeId(result.data.id);
      } else {
        if (!recipeId) return;
        const result = await updateRecipe(recipeId, data);
        if (result.error || !result.data) {
          toast.error((result.error as string) || "Failed to update recipe");
          return;
        }
        setSavedRecipeId(result.data.id);
      }
      onSubmitSuccess();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }, [form, mode, recipeId, onSubmitSuccess]);

  return {
    form,
    ingredientFields: {
      fields: ingredientFieldsArr,
      append: appendIngredient,
      remove: removeIngredient,
    },
    instructionFields: {
      fields: instructionValues,
      append: appendInstruction,
      remove: removeInstruction,
    },
    categories,
    nutritionLoading,
    nutritionResult,
    isSubmitting,
    savedRecipeId,
    analyzeNutrition,
    handleSubmit,
    resetForm,
  };
}
