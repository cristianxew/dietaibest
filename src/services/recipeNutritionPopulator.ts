/**
 * Recipe Nutrition Auto-Population Service
 *
 * Automatically analyzes and populates nutritional data for recipes when they are created or imported.
 * This service ensures that the database is progressively populated with nutrition data.
 */

import {
  parseIngredientString,
  calculateNutrition,
} from "./nutritionCalculator";
import type { RecipeFormData } from "@/types/recipe";

interface NutritionPopulationResult {
  success: boolean;
  nutritionData?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  };
  confidence?: number;
  warnings?: string[];
  sourceStats?: {
    local: number;
    usda: number;
    cached: number;
  };
}

/**
 * Automatically populate nutrition data for a recipe
 */
export async function autoPopulateRecipeNutrition(
  recipe: RecipeFormData
): Promise<NutritionPopulationResult> {
  try {
    // Skip if recipe already has comprehensive nutrition data
    if (hasComprehensiveNutrition(recipe)) {
      return {
        success: true,
        nutritionData: {
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
          fiber: recipe.fiber,
          sugar: recipe.sugar,
          sodium: recipe.sodium,
        },
        confidence: 100, // User-provided data is highest confidence
        warnings: ["Recipe already contains nutrition data"],
      };
    }

    // Parse ingredients from the recipe
    const parsedIngredients = [];

    if (Array.isArray(recipe.ingredients)) {
      // Already structured ingredients
      for (const ing of recipe.ingredients) {
        if (
          ing &&
          typeof ing === "object" &&
          ing.name &&
          ing.amount &&
          ing.unit
        ) {
          parsedIngredients.push({
            name: ing.name,
            amount: ing.amount,
            unit: ing.unit,
          });
        }
      }
    } else if (typeof recipe.ingredients === "string") {
      // String-based ingredients list
      const ingredientLines = recipe.ingredients.split("\n");
      for (const line of ingredientLines) {
        if (line.trim()) {
          const parsed = parseIngredientString(line.trim());
          if (parsed) {
            parsedIngredients.push(parsed);
          }
        }
      }
    }

    if (parsedIngredients.length === 0) {
      return {
        success: false,
        warnings: ["No valid ingredients found to analyze"],
      };
    }

    console.log(
      `🧮 Auto-analyzing nutrition for ${parsedIngredients.length} ingredients...`
    );

    // Calculate nutrition using the hybrid system
    const nutritionResult = await calculateNutrition(parsedIngredients, {
      servings: recipe.servings || 1,
      preferUSDA: false, // Start with local database first
      includeConfidence: true,
      useCache: true,
    });

    // Extract key nutrition values
    const nutritionData = extractKeyNutrients(nutritionResult.perServing);

    // Determine overall confidence and provide helpful feedback
    const confidence = nutritionResult.overallConfidence;
    const warnings = nutritionResult.metadata.warnings;

    const sourceStats = {
      local: nutritionResult.metadata.localMatches,
      usda: nutritionResult.metadata.usdaMatches,
      cached: nutritionResult.metadata.cachedMatches,
    };

    // Add informational messages
    if (sourceStats.usda > 0) {
      warnings.push(
        `Retrieved ${sourceStats.usda} ingredient(s) from USDA database and cached locally`
      );
    }

    console.log(
      `✅ Auto-populated nutrition data with ${confidence}% confidence`
    );

    return {
      success: true,
      nutritionData,
      confidence,
      warnings,
      sourceStats,
    };
  } catch (error) {
    console.error("Error auto-populating recipe nutrition:", error);
    return {
      success: false,
      warnings: [
        `Failed to analyze nutrition: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      ],
    };
  }
}

/**
 * Check if recipe already has comprehensive nutrition data
 */
function hasComprehensiveNutrition(recipe: RecipeFormData): boolean {
  return !!(recipe.calories && recipe.protein && recipe.carbs && recipe.fat);
}

/**
 * Extract key nutrients from detailed nutrition results
 */
function extractKeyNutrients(
  nutrients: Array<{
    nutrient: { name: string };
    value: number;
  }>
): {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
} {
  const result: Record<string, number> = {};

  // Flexible nutrient matching
  const findNutrient = (names: string[]) => {
    for (const name of names) {
      const nutrient = nutrients.find((n) =>
        n.nutrient.name.toLowerCase().includes(name.toLowerCase())
      );
      if (nutrient) return nutrient.value;
    }
    return undefined;
  };

  // Map common nutrients
  result.calories = findNutrient(["energy", "calories", "kcal"]);
  result.protein = findNutrient(["protein"]);
  result.carbs = findNutrient([
    "carbohydrates",
    "carbs",
    "total carbohydrates",
  ]);
  result.fat = findNutrient(["total fat", "fat", "total lipid"]);
  result.fiber = findNutrient([
    "dietary fiber",
    "fiber",
    "total dietary fiber",
  ]);
  result.sugar = findNutrient(["total sugars", "sugars", "sugar"]);
  result.sodium = findNutrient(["sodium"]);

  // Remove undefined values
  Object.keys(result).forEach((key) => {
    if (result[key] === undefined) {
      delete result[key];
    }
  });

  return result;
}

/**
 * Batch populate nutrition for multiple recipes
 */
export async function batchPopulateNutrition(
  recipes: RecipeFormData[]
): Promise<Map<string, NutritionPopulationResult>> {
  const results = new Map<string, NutritionPopulationResult>();

  // Process in batches to avoid overwhelming the system
  const BATCH_SIZE = 3;

  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (recipe, index) => {
        const result = await autoPopulateRecipeNutrition(recipe);
        return { id: `recipe_${i + index}`, result };
      })
    );

    for (const { id, result } of batchResults) {
      results.set(id, result);
    }

    // Add small delay between batches to respect rate limits
    if (i + BATCH_SIZE < recipes.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

/**
 * Enhanced recipe nutrition update that preserves user data
 */
export function mergeNutritionData(
  existingRecipe: RecipeFormData,
  autoPopulatedData: NutritionPopulationResult["nutritionData"]
): RecipeFormData {
  if (!autoPopulatedData) return existingRecipe;

  return {
    ...existingRecipe,
    // Only update fields that are not already set by the user
    calories: existingRecipe.calories || autoPopulatedData.calories,
    protein: existingRecipe.protein || autoPopulatedData.protein,
    carbs: existingRecipe.carbs || autoPopulatedData.carbs,
    fat: existingRecipe.fat || autoPopulatedData.fat,
    fiber: existingRecipe.fiber || autoPopulatedData.fiber,
    sugar: existingRecipe.sugar || autoPopulatedData.sugar,
    sodium: existingRecipe.sodium || autoPopulatedData.sodium,
  };
}
