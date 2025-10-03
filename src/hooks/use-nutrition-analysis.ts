"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { type NutrientData } from "@/utils/nutrientFinder";

export interface NutritionData {
  totalNutrients: NutrientData[];
  perServing: NutrientData[];
  servings: number;
  overallConfidence: number;
  summary: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
}

interface AnalysisResult {
  nutrition?: NutritionData;
  matchedIngredients: number;
  totalIngredients: number;
  confidence: number;
  warnings: string[];
  sources?: {
    local: number;
    usda: number;
    cached: number;
  };
}

interface UseNutritionAnalysisOptions {
  servings?: number;
  includeNutrition?: boolean;
  includeDiets?: boolean;
  includeAllergens?: boolean;
  preferUSDA?: boolean;
  onSuccess?: (result: AnalysisResult) => void;
  onError?: (error: string) => void;
}

export function useNutritionAnalysis(
  options: UseNutritionAnalysisOptions = {}
) {
  // Development helper - expose clear function to window
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    (
      window as typeof window & {
        clearNutritionRateLimit?: () => Promise<void>;
        getNutritionStats?: () => Promise<void>;
      }
    ).clearNutritionRateLimit = async () => {
      try {
        await fetch("/api/nutrition/analyze", { method: "DELETE" });
        console.log("Rate limit cleared");
      } catch (error) {
        console.error("Failed to clear rate limit:", error);
      }
    };

    (
      window as typeof window & { getNutritionStats?: () => Promise<void> }
    ).getNutritionStats = async () => {
      try {
        const response = await fetch("/api/nutrition/analyze", {
          method: "GET",
        });
        const data = await response.json();
        console.log("Nutrition Stats:", data);
      } catch (error) {
        console.error("Failed to get stats:", error);
      }
    };
  }

  const {
    servings = 1,
    includeNutrition = true,
    includeDiets = false,
    includeAllergens = false,
    preferUSDA = false,
    onSuccess,
    onError,
  } = options;

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const failureCountRef = useRef(0);
  const lastFailureTimeRef = useRef<number>(0);
  const lastRequestTimeRef = useRef<number>(0);

  const analyzeNutrition = useCallback(
    async (
      ingredients: Array<{ name: string; amount: number; unit: string }>,
      analysisOptions?: {
        includeNutrition?: boolean;
        includeDiets?: boolean;
        includeAllergens?: boolean;
        preferUSDA?: boolean;
      }
    ) => {
      // Use provided options or fall back to hook options
      const finalOptions = {
        includeNutrition: analysisOptions?.includeNutrition ?? includeNutrition,
        includeDiets: analysisOptions?.includeDiets ?? includeDiets,
        includeAllergens: analysisOptions?.includeAllergens ?? includeAllergens,
        preferUSDA: analysisOptions?.preferUSDA ?? preferUSDA,
      };

      // Circuit breaker: stop requests if too many failures
      const now = Date.now();
      if (now - lastFailureTimeRef.current > 30000) {
        failureCountRef.current = 0; // Reset after 30 seconds
      }

      if (failureCountRef.current >= 3) {
        setError("Too many failed requests. Please wait and try again.");
        return;
      }

      // Prevent rapid requests (minimum 500ms between requests)
      const timeSinceLastRequest = now - lastRequestTimeRef.current;
      if (timeSinceLastRequest < 500) {
        // Too soon after previous request – skip to debounce effectively
        return;
      }

      // Update trackers
      lastRequestTimeRef.current = now;

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Validate ingredients parameter
      if (!ingredients || !Array.isArray(ingredients)) {
        setError("Invalid ingredients data");
        return;
      }

      // Skip empty ingredients
      const validIngredients = ingredients.filter(
        (ing) => ing && ing.name && ing.name.trim() !== ""
      );

      if (validIngredients.length === 0) {
        setData(null);
        setError(null);
        return;
      }

      // Format ingredients as strings for the API
      const ingredientStrings = validIngredients.map((ing) => {
        const parts = [];
        if (ing.amount) parts.push(ing.amount);
        if (ing.unit) parts.push(ing.unit);
        parts.push(ing.name);
        return parts.join(" ");
      });

      setIsLoading(true);
      setError(null);

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/nutrition/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ingredients: ingredientStrings,
            servings,
            options: {
              includeNutrition: finalOptions.includeNutrition,
              includeDiets: finalOptions.includeDiets,
              includeAllergens: finalOptions.includeAllergens,
              includeConfidence: true,
              strictMode: false,
              preferUSDA: finalOptions.preferUSDA,
            },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          failureCountRef.current++;
          lastFailureTimeRef.current = Date.now();

          if (response.status === 404) {
            throw new Error(
              "API endpoint not found. Please restart the server."
            );
          }

          if (response.status === 429) {
            // Rate limited - increase failure count more aggressively
            failureCountRef.current += 2;
            throw new Error(
              "Rate limit exceeded. Please wait a moment before trying again."
            );
          }

          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to analyze nutrition");
        }

        const result = await response.json();

        console.log("Nutrition analysis result:", result);

        if (result.success && result.data) {
          // Reset failure count and last failure time on success
          failureCountRef.current = 0;
          lastFailureTimeRef.current = 0;

          const analysisResult: AnalysisResult = {
            nutrition: result.data.nutrition,
            matchedIngredients: result.data.metadata.matchedIngredients,
            totalIngredients: result.data.metadata.totalIngredients,
            confidence: result.data.metadata.confidence,
            warnings: result.data.metadata.warnings || [],
            sources: result.data.metadata.sources,
          };

          setData(analysisResult);
          onSuccess?.(analysisResult);

          // Show source information in development
          if (
            process.env.NODE_ENV === "development" &&
            analysisResult.sources
          ) {
            console.log("Nutrition data sources:", analysisResult.sources);
          }

          // Show warnings if any
          if (analysisResult.warnings.length > 0) {
            const warningMessage = analysisResult.warnings[0];
            // Only show the first warning as a toast to avoid spam
            if (analysisResult.warnings.length > 1) {
              toast.warning(
                `${warningMessage} (+${
                  analysisResult.warnings.length - 1
                } more)`
              );
            } else {
              toast.warning(warningMessage);
            }
          }

          // Show data source summary if interesting
          if (analysisResult.sources) {
            const { usda } = analysisResult.sources;
            if (usda > 0) {
              toast.info(`Retrieved ${usda} ingredient(s) from USDA database`);
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Request was cancelled, ignore
          return;
        }

        // Track failure
        failureCountRef.current++;
        lastFailureTimeRef.current = Date.now();

        const errorMessage =
          err instanceof Error ? err.message : "Failed to analyze nutrition";
        setError(errorMessage);
        onError?.(errorMessage);

        // Don't show toast for every error to avoid spamming
        console.error("Nutrition analysis error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      servings,
      includeNutrition,
      includeDiets,
      includeAllergens,
      preferUSDA,
      onSuccess,
      onError,
    ]
  );

  // Analyze with diet compatibility
  const analyzeWithDiets = useCallback(
    async (
      ingredients: Array<{ name: string; amount: number; unit: string }>,
      diets: string[]
    ) => {
      if (!diets || diets.length === 0) {
        toast.error("Please specify diet types to check");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Format ingredients
        const ingredientStrings = ingredients
          .filter((ing) => ing && ing.name && ing.name.trim() !== "")
          .map((ing) => {
            const parts = [];
            if (ing.amount) parts.push(ing.amount);
            if (ing.unit) parts.push(ing.unit);
            parts.push(ing.name);
            return parts.join(" ");
          });

        const response = await fetch("/api/nutrition/diet-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ingredients: ingredientStrings,
            diets,
            servings,
            options: {
              includeNutrition: true,
              includeModifications: true,
              includeMacroAnalysis: true,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to check diet compatibility"
          );
        }

        const result = await response.json();

        if (result.success && result.data) {
          // Transform diet check results to our format

          const analysisResult: AnalysisResult = {
            matchedIngredients: ingredients.length,
            totalIngredients: ingredients.length,
            confidence: 100,
            warnings: result.data.metadata.warnings || [],
          };

          setData(analysisResult);
          onSuccess?.(analysisResult);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to check diet compatibility";
        setError(errorMessage);
        onError?.(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [servings, onSuccess, onError]
  );

  // Check for allergens
  const checkAllergens = useCallback(
    async (
      ingredients: Array<{ name: string; amount: number; unit: string }>,
      userAllergens?: string[]
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        // Format ingredients
        const ingredientStrings = ingredients
          .filter((ing) => ing && ing.name && ing.name.trim() !== "")
          .map((ing) => {
            const parts = [];
            if (ing.amount) parts.push(ing.amount);
            if (ing.unit) parts.push(ing.unit);
            parts.push(ing.name);
            return parts.join(" ");
          });

        const response = await fetch("/api/nutrition/allergen-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ingredients: ingredientStrings,
            userAllergens,
            options: {
              includeCrossContamination: true,
              sensitivityLevel: "standard",
              includeSubstitutions: true,
              groupByCategory: true,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to check allergens");
        }

        const result = await response.json();

        if (result.success && result.data) {
          const analysisResult: AnalysisResult = {
            matchedIngredients: ingredients.length,
            totalIngredients: ingredients.length,
            confidence: result.data.metadata.overallConfidence,
            warnings: result.data.metadata.warnings || [],
          };

          setData(analysisResult);
          onSuccess?.(analysisResult);

          // Show user-specific warnings if any
          if (result.data.userSpecificWarnings?.length > 0) {
            result.data.userSpecificWarnings.forEach(
              (warning: {
                message: string;
                urgency: "high" | "medium" | "low";
              }) => {
                if (warning.urgency === "high") {
                  toast.error(warning.message);
                } else {
                  toast.warning(warning.message);
                }
              }
            );
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to check allergens";
        setError(errorMessage);
        onError?.(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError]
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    analyze: analyzeNutrition,
    analyzeWithDiets,
    checkAllergens,
    isLoading,
    data,
    error,
    cleanup,
  };
}
