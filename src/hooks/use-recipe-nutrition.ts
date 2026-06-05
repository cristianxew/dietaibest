"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useLocale } from "next-intl";
import { analyzeRecipeNutritionAction } from "@/actions/nutrition";
import type { NutritionAnalysisResult } from "@/lib/edamam-service";

interface UseRecipeNutritionOptions {
  onSuccess?: (result: NutritionAnalysisResult) => void;
  onError?: (error: string) => void;
}

export function useRecipeNutrition(options: UseRecipeNutritionOptions = {}) {
  const { onSuccess, onError } = options;
  const locale = useLocale() as "en" | "es" | "pl";

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<NutritionAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (
      title: string,
      ingredients: Array<{ name: string; amount: number; unit?: string }>,
      servings: number,
      url: string | undefined,
      instructions: string[]
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

        // Call the new Edamam nutrition action
        const result = await analyzeRecipeNutritionAction(
          {
            title: title || "Untitled Recipe",
            ingredients: ingredientStrings,
            url,
            instructions: instructions || [],
            servings,
          },
          {
            locale,
            forceRefresh: false,
          }
        );

        if (result.success && result.data) {
          setData(result.data);
          onSuccess?.(result.data);

          // Show success message with cache info
          if (result.data.fromCache) {
            toast.success("Nutrition loaded from cache", {
              description: `${Math.round(
                result.data.macros.calories
              )} kcal per serving`,
            });
          } else {
            toast.success("Nutrition analyzed successfully", {
              description: `${Math.round(
                result.data.macros.calories
              )} kcal per serving`,
            });
          }

          // Show diet/health labels if any
          const labels = [
            ...result.data.dietLabels,
            ...result.data.healthLabels,
          ];
          if (labels.length > 0) {
            toast.info(`Labels: ${labels.slice(0, 3).join(", ")}`);
          }

          // Show cautions if any
          if (result.data.cautions && result.data.cautions.length > 0) {
            toast.warning(
              `Allergen warnings: ${result.data.cautions
                .slice(0, 3)
                .join(", ")}`
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
    [onSuccess, onError, locale]
  );

  return {
    analyze,
    isLoading,
    data,
    error,
  };
}
