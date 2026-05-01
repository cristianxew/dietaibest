"use client";

import { createContext, useContext, useRef } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { useForm, useFieldArray, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useCallback } from "react";
import { recipeFormSchema, type RecipeFormData, type ImportedRecipeData } from "@/types/recipe";
import { createRecipe, updateRecipe, getCategories } from "@/actions/recipe";
import { analyzeRecipeNutritionAction, type NutritionAnalysisResult } from "@/actions/nutrition";
import { ingredientsToNutritionLines } from "@/lib/recipe-utils";
import { toast } from "sonner";

export type ModalScreen =
  | "entry"
  | "loading"
  | "preview"
  | "step0"
  | "step1"
  | "step2"
  | "success";

type EnteredVia = "import" | "manual" | "edit";

type RecipeCategory = { id: string; name: string; slug: string };

export interface RecipeModalCtx {
  isOpen: boolean;
  screen: ModalScreen;
  mode: "create" | "edit";
  enteredVia: EnteredVia;
  recipeId: string | null;
  openCreate: () => void;
  openEdit: (recipeId: string, data: RecipeFormData) => void;
  close: () => void;
  goToScreen: (screen: ModalScreen) => void;
  goBack: () => void;
  goToNextStep: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<RecipeFormData, any, undefined>;
  ingredientFields: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    append: (value: any) => void;
    remove: (index: number) => void;
  };
  instructionFields: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    append: (value: any) => void;
    remove: (index: number) => void;
  };
  categories: RecipeCategory[];
  importedPreview: ImportedRecipeData | null;
  setImportedPreview: (data: ImportedRecipeData) => void;
  analyzeNutrition: () => Promise<void>;
  nutritionLoading: boolean;
  nutritionResult: NutritionAnalysisResult | null;
  isSubmitting: boolean;
  savedRecipeId: string | null;
  handleSubmit: () => Promise<void>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const RecipeModalContext = createContext<RecipeModalCtx | null>(null);

export function useRecipeModal(): RecipeModalCtx {
  const ctx = useContext(RecipeModalContext);
  if (!ctx) throw new Error("useRecipeModal must be used within RecipeModalProvider");
  return ctx;
}

export { RecipeModalContext };

const STEP_FIELDS: Record<string, (keyof RecipeFormData)[]> = {
  step0: ["title", "servings"],
  step1: ["ingredients", "instructions"],
  step2: [],
};

const NEXT_SCREEN: Partial<Record<ModalScreen, ModalScreen>> = {
  step0: "step1",
  step1: "step2",
};

export function useRecipeModalState(): RecipeModalCtx {
  const [isOpen, setIsOpen] = useState(false);
  const [screen, setScreen] = useState<ModalScreen>("entry");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [enteredVia, setEnteredVia] = useState<EnteredVia>("manual");
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [importedPreview, setImportedPreview] = useState<ImportedRecipeData | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [nutritionResult, setNutritionResult] = useState<NutritionAnalysisResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<RecipeFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(recipeFormSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      imageUrl: "",
      servings: 1,
      ingredients: [{ name: "", amount: 1, unit: "" }],
      instructions: [""],
      tags: [],
      categoryIds: [],
      isPublic: false,
    },
  });

  const { fields: ingredientFieldsArr, append: appendIngredientField, remove: removeIngredientField } =
    useFieldArray({ control: form.control, name: "ingredients" });

  const { fields: instructionFieldsArr, append: appendInstructionField, remove: removeInstructionField } =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useFieldArray({ control: form.control as any, name: "instructions" as any });

  const ingredientFields = {
    fields: ingredientFieldsArr,
    append: appendIngredientField,
    remove: removeIngredientField,
  };

  const instructionFields = {
    fields: instructionFieldsArr,
    append: appendInstructionField,
    remove: removeInstructionField,
  };

  useEffect(() => {
    if (!isOpen) return;
    getCategories().then(({ data }) => {
      if (data) setCategories(data);
    });
  }, [isOpen]);

  const resetForm = useCallback(() => {
    form.reset({
      title: "",
      description: "",
      imageUrl: "",
      servings: 1,
      ingredients: [{ name: "", amount: 1, unit: "" }],
      instructions: [""],
      tags: [],
      categoryIds: [],
      isPublic: false,
    });
    setImportedPreview(null);
    setNutritionResult(null);
    setSavedRecipeId(null);
  }, [form]);

  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, []);

  const goToScreen = useCallback((nextScreen: ModalScreen) => {
    setScreen(nextScreen);
    setTimeout(scrollToTop, 50);
  }, [scrollToTop]);

  const openCreate = useCallback(() => {
    resetForm();
    setMode("create");
    setEnteredVia("manual");
    setRecipeId(null);
    setScreen("entry");
    setIsOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((id: string, data: RecipeFormData) => {
    form.reset(data);
    setMode("edit");
    setEnteredVia("edit");
    setRecipeId(id);
    setImportedPreview(null);
    setNutritionResult(null);
    setSavedRecipeId(null);
    setScreen("step0");
    setIsOpen(true);
  }, [form]);

  const close = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setScreen("entry");
      resetForm();
      setMode("create");
      setEnteredVia("manual");
      setRecipeId(null);
    }, 300);
  }, [resetForm]);

  const goBack = useCallback(() => {
    if (screen === "entry") {
      close();
    } else if (screen === "loading" || screen === "preview") {
      goToScreen("entry");
    } else if (screen === "step0") {
      if (mode === "edit") {
        close();
      } else if (enteredVia === "import") {
        goToScreen("preview");
      } else {
        goToScreen("entry");
      }
    } else if (screen === "step1") {
      goToScreen("step0");
    } else if (screen === "step2") {
      goToScreen("step1");
    }
  }, [screen, mode, enteredVia, close, goToScreen]);

  const goToNextStep = useCallback(async () => {
    const fields = STEP_FIELDS[screen] || [];
    if (fields.length > 0) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    const next = NEXT_SCREEN[screen];
    if (next) goToScreen(next);
  }, [screen, form, goToScreen]);

  const analyzeNutrition = useCallback(async () => {
    const { title, ingredients, servings } = form.getValues();
    const lines = ingredientsToNutritionLines(ingredients);
    if (!lines.length) {
      toast.error("Add ingredients before analyzing nutrition");
      return;
    }
    setNutritionLoading(true);
    try {
      const result = await analyzeRecipeNutritionAction({
        title,
        ingredients: lines,
        servings,
      });
      if (result.success && result.data) {
        setNutritionResult(result.data);
        const { macros } = result.data;
        form.setValue("calories", Math.round(macros.calories));
        form.setValue("protein", Math.round(macros.protein));
        form.setValue("carbs", Math.round(macros.netCarbs));
        form.setValue("fat", Math.round(macros.fat));
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
        const result = await createRecipe(data);
        if (result.error || !result.data) {
          toast.error(result.error || "Failed to save recipe");
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
      goToScreen("success");
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }, [form, mode, recipeId, goToScreen]);

  return {
    isOpen,
    screen,
    mode,
    enteredVia,
    recipeId,
    openCreate,
    openEdit,
    close,
    goToScreen,
    goBack,
    goToNextStep,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form: form as any,
    ingredientFields,
    instructionFields,
    categories,
    importedPreview,
    setImportedPreview,
    analyzeNutrition,
    nutritionLoading,
    nutritionResult,
    isSubmitting,
    savedRecipeId,
    handleSubmit,
    scrollContainerRef,
  };
}
