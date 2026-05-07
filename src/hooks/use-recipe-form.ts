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
import type { NutritionAnalysisResult } from "@/actions/nutrition";
import { useRecipeNutrition } from "@/hooks/use-recipe-nutrition";
import { usePaywall } from "@/components/billing/PaywallProvider";
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
  nutritionResult: NutritionAnalysisResult | null;
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
  const [nutritionResult, setNutritionResult] = useState<NutritionAnalysisResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);

  const form = useForm<RecipeFormData>({
    // zodResolver infers z.input<Schema> (pre-transform) for TFieldValues, but our form
    // is typed as RecipeFormData (z.infer, post-transform). The cast aligns them — safe
    // because DEFAULT_VALUES always satisfies both types at runtime.
    resolver: zodResolver(recipeFormSchema) as Resolver<RecipeFormData>,
    defaultValues: DEFAULT_VALUES,
  });

  const paywall = usePaywall();

  const { analyze: runAnalysis, isLoading: nutritionLoading } = useRecipeNutrition({
    onSuccess: (result) => {
      setNutritionResult(result);
      const { macros } = result;
      form.setValue("calories", Math.round(macros.calories));
      form.setValue("protein", Math.round(macros.protein));
      form.setValue("carbs", Math.round(macros.netCarbs));
      form.setValue("fat", Math.round(macros.fat));
    },
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
    const { title, ingredients, servings, instructions, sourceUrl } =
      form.getValues();
    if (!ingredients?.some((ing) => ing?.name?.trim())) {
      toast.error("Add ingredients before analyzing nutrition");
      return;
    }
    await runAnalysis(
      title,
      ingredients,
      servings,
      sourceUrl || undefined,
      instructions ?? [],
    );
  }, [form, runAnalysis]);

  const handleSubmit = useCallback(async () => {
    const valid = await form.trigger();
    if (!valid) {
      const errors = form.formState.errors;
      const firstError = Object.values(errors).find(
        (e) => e && typeof e === "object" && "message" in e,
      ) as { message?: string } | undefined;
      toast.error(firstError?.message || "Please fix the errors in the form");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = form.getValues();
      if (mode === "create") {
        const source = data.sourceUrl
          ? (data.sourceUrl.startsWith("http") ? "url" : "imported")
          : "manual";
        const result = await persistRecipe(data, { source });
        if (result.error || !result.data) {
          if (result.error && typeof result.error !== "string") {
            paywall.open(result.error);
          } else {
            toast.error(result.error || "Failed to save recipe");
          }
          return;
        }
        setSavedRecipeId(result.data.id);
      } else {
        if (!recipeId) return;
        const result = await updateRecipe(recipeId, data);
        if (result.error || !result.data) {
          toast.error(result.error || "Failed to update recipe");
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
  }, [form, mode, recipeId, onSubmitSuccess, paywall]);

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
