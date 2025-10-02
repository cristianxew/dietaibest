import { Ingredient } from "@/types/recipe";
import { toast } from "sonner";

interface UseRecipeFormHandlersProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any; // Using any to avoid complex type matching with react-hook-form
  watchedIngredients: Ingredient[];
  analyzeNutrition: (
    ingredients: Ingredient[],
    options: {
      includeNutrition: boolean;
      preferUSDA: boolean;
    }
  ) => void;
}

export function useRecipeFormHandlers({
  form,
  watchedIngredients,
  analyzeNutrition,
}: UseRecipeFormHandlersProps) {
  const handleAddTag = (tag: string) => {
    const currentTags = form.getValues("tags") || [];
    if (tag && !currentTags.includes(tag)) {
      form.setValue("tags", [...currentTags, tag]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags");
    form.setValue(
      "tags",
      currentTags?.filter((tag: string) => tag !== tagToRemove)
    );
  };

  const handleAnalyzeNutrition = (preferUSDA = true) => {
    if (watchedIngredients && Array.isArray(watchedIngredients)) {
      const validIngredients = watchedIngredients.filter(
        (ing) =>
          ing && typeof ing === "object" && ing.name && ing.amount && ing.unit
      );

      if (validIngredients.length > 0) {
        analyzeNutrition(validIngredients, {
          includeNutrition: true,
          preferUSDA,
        });
      } else {
        toast.error("Please add some ingredients before analyzing nutrition");
      }
    }
  };

  return {
    handleAddTag,
    handleRemoveTag,
    handleAnalyzeNutrition,
  };
}
