/**
 * Server Actions for Nutrition Analysis
 *
 * Provides server-side functions for analyzing recipe nutrition
 * with authentication and error handling built-in.
 */

"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import type { Recipe } from "@/generated/prisma";
import {
  analyzeRecipeNutrition,
  getCachedRecipeNutrition,
  getRecipeNutritionSummary,
  clearRecipeNutritionCache,
  type RecipeNutritionInput,
  type NutritionAnalysisResult,
  type NutritionAnalysisError,
} from "@/lib/edamam-service";
import { assertCanUseEdamamAnalysis } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import { applyNutritionToRecipe } from "@/lib/recipe-nutrition";

// Re-export types for use in components
export type {
  NutritionAnalysisResult,
  NutritionAnalysisError,
  RecipeNutritionInput,
};

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Analyze recipe nutrition
 * Returns nutrition data or error information
 */
export async function analyzeRecipeNutritionAction(
  recipe: RecipeNutritionInput,
  options: {
    forceRefresh?: boolean;
    locale?: "en" | "es" | "pl";
  } = {}
): Promise<{
  success: boolean;
  data?: NutritionAnalysisResult;
  error?: string;
  code?: string;
  retryable?: boolean;
}> {
  try {
    const user = await getAuthenticatedUser();
    await assertCanUseEdamamAnalysis(user);

    const result = await analyzeRecipeNutrition(recipe, user.id, options);

    // Check if result is an error
    if ("error" in result) {
      return {
        success: false,
        error: result.error,
        code: result.code,
        retryable: result.retryable,
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    const entError = toEntitlementError(error);
    if (entError) {
      return { success: false, error: JSON.stringify(entError), code: entError.code, retryable: false };
    }
    console.error("[Action] analyzeRecipeNutrition failed:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to analyze recipe",
      code: "INTERNAL_ERROR",
      retryable: false,
    };
  }
}

/**
 * Get cached nutrition for a recipe
 */
export async function getCachedRecipeNutritionAction(
  recipeId: string
): Promise<{
  success: boolean;
  data?: NutritionAnalysisResult;
  error?: string;
}> {
  try {
    const user = await getAuthenticatedUser();

    const result = await getCachedRecipeNutrition(user.id, recipeId);

    if (!result) {
      return {
        success: false,
        error: "No cached nutrition data found",
      };
    }

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Action] getCachedRecipeNutrition failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get cached nutrition",
    };
  }
}

/**
 * Get nutrition summary for multiple recipes
 */
export async function getRecipeNutritionSummaryAction(
  recipeIds: string[]
): Promise<{
  success: boolean;
  data?: {
    total: { calories: number; protein: number; fat: number; netCarbs: number };
    byRecipe: Array<{
      recipeId: string;
      macros: {
        calories: number;
        protein: number;
        fat: number;
        netCarbs: number;
      };
    }>;
  };
  error?: string;
}> {
  try {
    const user = await getAuthenticatedUser();

    const result = await getRecipeNutritionSummary(recipeIds, user.id);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error("[Action] getRecipeNutritionSummary failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get nutrition summary",
    };
  }
}

/**
 * Clear cached nutrition for a recipe
 */
export async function clearRecipeNutritionCacheAction(
  recipeId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getAuthenticatedUser();

    await clearRecipeNutritionCache(recipeId, user.id);

    return {
      success: true,
    };
  } catch (error) {
    console.error("[Action] clearRecipeNutritionCache failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear cache",
    };
  }
}

/**
 * Analyze and update recipe with nutrition data
 * This is a convenience action that analyzes nutrition and updates the recipe in one go
 */
export async function analyzeAndUpdateRecipe(
  recipeId: string,
  options: {
    forceRefresh?: boolean;
    locale?: "en" | "es" | "pl";
  } = {}
): Promise<{
  success: boolean;
  data?: {
    recipe: Recipe;
    nutrition: NutritionAnalysisResult;
  };
  error?: string;
}> {
  try {
    const user = await getAuthenticatedUser();

    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, userId: user.id },
    });

    if (!recipe) {
      return {
        success: false,
        error: "Recipe not found",
      };
    }

    const outcome = await applyNutritionToRecipe(recipe, user.id, options);

    if (outcome.kind === "noop") {
      return {
        success: false,
        error: "Recipe has no ingredients to analyze",
      };
    }

    if (outcome.kind === "failed") {
      return {
        success: false,
        error: outcome.reason,
      };
    }

    return {
      success: true,
      data: {
        recipe: outcome.recipe,
        nutrition: outcome.nutrition,
      },
    };
  } catch (error) {
    console.error("[Action] analyzeAndUpdateRecipe failed:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to analyze and update recipe",
    };
  }
}
