"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";

interface NutritionData {
  totalNutrients: Array<{
    nutrient: {
      id: string;
      name: string;
      nutrientCategory: string;
    };
    value: number;
    unit: string;
    percentDailyValue?: number;
    confidence: number;
  }>;
  perServing: Array<{
    nutrient: {
      id: string;
      name: string;
      nutrientCategory: string;
    };
    value: number;
    unit: string;
    percentDailyValue?: number;
    confidence: number;
  }>;
  servings: number;
  overallConfidence: number;
}

interface DietCompatibilityData {
  classifications: Array<{
    dietTypeName: string;
    isCompatible: boolean;
    confidence: number;
    reasons: string[];
    modifications?: string[];
  }>;
  primaryDiets: string[];
  partialDiets: string[];
  macroAnalysis: {
    carbPercentage: number;
    proteinPercentage: number;
    fatPercentage: number;
    isKetogenic: boolean;
    isHighProtein: boolean;
    isLowFat: boolean;
    isBalanced: boolean;
  };
}

interface AllergenData {
  detectedAllergens: Array<{
    allergenId: string;
    allergenName: string;
    category: string;
    severity: string;
    detectionType: string;
    confidence: number;
    sources: string[];
    containsAmount?: string;
    warnings?: string[];
  }>;
  riskLevel: string;
  recommendedLabels: string[];
}

interface AnalysisResult {
  nutrition?: NutritionData;
  dietCompatibility?: DietCompatibilityData;
  allergens?: AllergenData;
  matchedIngredients: number;
  totalIngredients: number;
  confidence: number;
  warnings: string[];
}

interface UseNutritionAnalysisOptions {
  servings?: number;
  includeNutrition?: boolean;
  includeDiets?: boolean;
  includeAllergens?: boolean;
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
      }
    ).clearNutritionRateLimit = async () => {
      try {
        await fetch("/api/nutrition/analyze", { method: "DELETE" });
        console.log("Rate limit cleared");
      } catch (error) {
        console.error("Failed to clear rate limit:", error);
      }
    };
  }

  const {
    servings = 1,
    includeNutrition = true,
    includeDiets = false, // Changed default to false
    includeAllergens = false, // Changed default to false
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
      }
    ) => {
      // Use provided options or fall back to hook options
      const finalOptions = {
        includeNutrition: analysisOptions?.includeNutrition ?? includeNutrition,
        includeDiets: analysisOptions?.includeDiets ?? includeDiets,
        includeAllergens: analysisOptions?.includeAllergens ?? includeAllergens,
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

        if (result.success && result.data) {
          // Reset failure count and last failure time on success
          failureCountRef.current = 0;
          lastFailureTimeRef.current = 0;

          const analysisResult: AnalysisResult = {
            nutrition: result.data.nutrition,
            dietCompatibility: result.data.dietCompatibility,
            allergens: result.data.allergens,
            matchedIngredients: result.data.metadata.matchedIngredients,
            totalIngredients: result.data.metadata.totalIngredients,
            confidence: result.data.metadata.confidence,
            warnings: result.data.metadata.warnings || [],
          };

          setData(analysisResult);
          onSuccess?.(analysisResult);

          // Show warnings if any
          if (analysisResult.warnings.length > 0) {
            toast.warning(
              `Analysis completed with warnings: ${analysisResult.warnings[0]}`
            );
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
      onSuccess,
      onError,
    ]
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    analyze: analyzeNutrition,
    isLoading,
    data,
    error,
    cleanup,
  };
}
