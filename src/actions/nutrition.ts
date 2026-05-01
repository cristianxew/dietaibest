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
  saveUserMacroCache,
  type RecipeNutritionInput,
  type NutritionAnalysisResult,
  type NutritionAnalysisError,
} from "@/lib/edamam-service";
import { assertCanUseEdamamAnalysis } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";

// Re-export types for use in components
export type {
  NutritionAnalysisResult,
  NutritionAnalysisError,
  RecipeNutritionInput,
};

// Helper types
interface StructuredIngredient {
  name?: string;
  amount?: string | number;
  unit?: string;
}

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

    // Get recipe
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId, userId: user.id },
    });

    if (!recipe) {
      return {
        success: false,
        error: "Recipe not found",
      };
    }

    // Prepare nutrition input
    const ingredientLines: string[] = [];
    if (recipe.ingredients && typeof recipe.ingredients === "object") {
      const ingredientsArray = Array.isArray(recipe.ingredients)
        ? recipe.ingredients
        : [recipe.ingredients];

      for (const ing of ingredientsArray) {
        if (typeof ing === "string") {
          ingredientLines.push(ing);
        } else if (ing && typeof ing === "object") {
          // Handle structured ingredient format { name, amount, unit }
          const structuredIng = ing as StructuredIngredient;
          const name = structuredIng.name || "";
          const amount = structuredIng.amount || "";
          const unit = structuredIng.unit || "";
          if (name) {
            ingredientLines.push(`${amount} ${unit} ${name}`.trim());
          }
        }
      }
    }

    if (ingredientLines.length === 0) {
      return {
        success: false,
        error: "Recipe has no ingredients to analyze",
      };
    }

    const nutritionInput: RecipeNutritionInput = {
      title: recipe.title,
      ingredients: ingredientLines,
      servings: recipe.servings,
      url: recipe.sourceUrl || undefined,
      instructions: recipe.instructions,
    };

    // Analyze nutrition
    const nutritionResult = await analyzeRecipeNutrition(
      nutritionInput,
      user.id,
      options
    );

    if ("error" in nutritionResult) {
      return {
        success: false,
        error: nutritionResult.error,
      };
    }

    // Update recipe with nutrition data
    const updatedRecipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        calories: nutritionResult.macros.calories,
        protein: nutritionResult.macros.protein,
        carbs: nutritionResult.macros.netCarbs, // Store net carbs as carbs
        fat: nutritionResult.macros.fat,
        // Note: fiber is not in the 4 allowed cached macros
        updatedAt: new Date(),
      },
    });

    // Save user-specific macro cache (Edamam policy: only 4 macros)
    await saveUserMacroCache(
      user.id,
      recipeId,
      nutritionResult.macros,
      nutritionResult.servings
    );

    return {
      success: true,
      data: {
        recipe: updatedRecipe,
        nutrition: nutritionResult,
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
