import { Ingredient } from "@/types/recipe";
import { toast } from "sonner";

interface UseRecipeFormHandlersProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any; // Using any to avoid complex type matching with react-hook-form
  watchedIngredients: Ingredient[];
  watchedServings: number;
  analyzeNutrition: (ingredients: Ingredient[], servings: number) => void;
}

export function useRecipeFormHandlers({
  form,
  watchedIngredients,
  watchedServings,
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

  const handleAnalyzeNutrition = () => {
    if (watchedIngredients && Array.isArray(watchedIngredients)) {
      const validIngredients = watchedIngredients.filter(
        (ing) =>
          ing && typeof ing === "object" && ing.name && ing.amount && ing.unit
      );

      if (validIngredients.length > 0) {
        analyzeNutrition(validIngredients, watchedServings || 1);
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
