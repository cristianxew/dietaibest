"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  analyzeRecipeAction,
  type AnalyzeResult,
} from "@/actions/analyzeRecipe";

interface UseRecipeNutritionOptions {
  onSuccess?: (result: AnalyzeResult) => void;
  onError?: (error: string) => void;
}

export function useRecipeNutrition(options: UseRecipeNutritionOptions = {}) {
  const { onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (
      ingredients: Array<{ name: string; amount: number; unit: string }>,
      servings: number
    ) => {
      // Validate inputs
      const validIngredients = ingredients.filter(
        (ing) => ing && ing.name && ing.name.trim() !== ""
      );

      if (validIngredients.length === 0) {
        setData(null);
        setError(null);
        return;
      }

      if (!servings || servings <= 0) {
        toast.error("Servings must be a positive number");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Format ingredients as strings
        const ingredientStrings = validIngredients.map((ing) => {
          const parts = [];
          if (ing.amount) parts.push(ing.amount.toString());
          if (ing.unit) parts.push(ing.unit);
          parts.push(ing.name);
          return parts.join(" ");
        });

        // Call the server action directly
        const result = await analyzeRecipeAction({
          ingredients: ingredientStrings,
          servings,
        });

        if (result.success) {
          setData(result);
          onSuccess?.(result);

          // Show success message
          const matchedCount = result.items.filter(
            (item) => item.fdcId !== null
          ).length;
          const totalCount = result.items.length;

          if (matchedCount === totalCount) {
            toast.success(`All ${totalCount} ingredients matched!`);
          } else if (matchedCount > 0) {
            toast.success(
              `Matched ${matchedCount} of ${totalCount} ingredients`
            );

            if (matchedCount < totalCount) {
              const unmatchedItems = result.items
                .filter((item) => item.fdcId === null)
                .map((item) => item.name);
              toast.warning(
                `Could not find: ${unmatchedItems.slice(0, 3).join(", ")}${
                  unmatchedItems.length > 3 ? "..." : ""
                }`
              );
            }
          } else {
            toast.error(
              "No ingredients could be matched. Try being more specific."
            );
          }
        } else {
          throw new Error(result.error || "Analysis failed");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to analyze nutrition";
        setError(errorMessage);
        onError?.(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError]
  );

  return {
    analyze,
    isLoading,
    data,
    error,
  };
}
