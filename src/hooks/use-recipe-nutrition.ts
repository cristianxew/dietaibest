"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { analyzeRecipeProfileForFormAction } from "@/actions/nutrition";
import type { Profile } from "@/lib/fdc";

interface UseRecipeNutritionOptions {
  onSuccess?: (result: Profile) => void;
  onError?: (error: string) => void;
}

export function useRecipeNutrition(options: UseRecipeNutritionOptions = {}) {
  const { onSuccess, onError } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (
      ingredients: Array<{ name: string; amount: number; unit?: string }>,
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
        // Format ingredients as "amount unit name" lines for the FDC engine
        const ingredientStrings = validIngredients.map((ing) => {
          const parts = [];
          if (ing.amount) parts.push(ing.amount.toString());
          if (ing.unit) parts.push(ing.unit);
          parts.push(ing.name);
          return parts.join(" ");
        });

        // Call the USDA FDC profile action (no Edamam on the creation path)
        const result = await analyzeRecipeProfileForFormAction({
          ingredients: ingredientStrings,
          servings,
        });

        if (result.success && result.data) {
          setData(result.data);
          onSuccess?.(result.data);

          toast.success("Nutrition analyzed successfully", {
            description: `${Math.round(result.data.calories)} kcal per serving`,
          });
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
