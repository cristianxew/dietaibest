/**
 * Nutrition Calculator Service - Hybrid Approach
 *
 * Implements a simplified nutrition analysis pipeline:
 * 1. Parse ingredients from text
 * 2. Check local database for nutrient data
 * 3. Fall back to USDA FoodData Central for missing data
 * 4. Cache results for future use
 * 5. Aggregate and return nutrition totals
 */

import { z } from "zod";
import {
  getNutritionDataProvider,
  type NutrientInfo,
} from "./nutritionDataProvider";
import {
  cacheNutritionCalculation,
  getCachedNutritionCalculation,
} from "./ingredientNutritionDB";
import { standardizeToGrams } from "./ingredientDensity";
import {
  ensureBasicNutrients as ensureBasicNutrientsUtil,
  getSummaryNutrition as getSummaryNutritionUtil,
  type NutrientData,
} from "@/utils/nutrientFinder";

// Initialize enhanced data provider with database persistence
const dataProvider = getNutritionDataProvider();

// Input validation schemas
const IngredientInputSchema = z.object({
  name: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
  preparation: z.string().optional(),
});

const CalculationOptionsSchema = z.object({
  servings: z.number().positive().default(1),
  useCache: z.boolean().default(true),
  preferUSDA: z.boolean().default(true),
  includeConfidence: z.boolean().default(true),
});

export type IngredientInput = z.infer<typeof IngredientInputSchema>;
export type CalculationOptions = z.infer<typeof CalculationOptionsSchema>;

// Nutrient result structure - using centralized type
export type NutrientResult = NutrientData;

export interface NutritionCalculationResult {
  totalNutrients: NutrientResult[];
  perServing: NutrientResult[];
  servings: number;
  overallConfidence: number;
  metadata: {
    totalIngredients: number;
    matchedIngredients: number;
    localMatches: number;
    usdaMatches: number;
    cachedMatches: number;
    warnings: string[];
  };
}

/**
 * Main nutrition calculation function
 * Processes ingredients and returns aggregated nutrition data
 */
export async function calculateNutrition(
  ingredients: IngredientInput[],
  options: Partial<CalculationOptions> = {}
): Promise<NutritionCalculationResult> {
  const opts = CalculationOptionsSchema.parse(options);
  const warnings: string[] = [];

  // Check database cache first for complete calculation
  const cachedResult = await getCachedNutritionCalculation(
    ingredients,
    opts.servings
  );
  if (cachedResult && opts.useCache) {
    console.log("📦 Returning cached nutrition calculation from database");
    return cachedResult;
  }

  // Track match sources
  let localMatches = 0;
  let usdaMatches = 0;
  let cachedMatches = 0;
  let matchedIngredients = 0;

  // Aggregate nutrients across all ingredients
  const nutrientTotals = new Map<string, NutrientResult>();

  // PERFORMANCE FIX: Batch process ingredients with concurrency control
  // Instead of sequential processing (24 × 15s = 6 minutes), process 5 at a time
  const BATCH_SIZE = 5;
  const validatedIngredients: typeof ingredients = [];

  // Pre-validate all ingredients
  for (const ingredient of ingredients) {
    try {
      validatedIngredients.push(IngredientInputSchema.parse(ingredient));
    } catch (error) {
      console.error(`Invalid ingredient:`, error);
      warnings.push(`Invalid ingredient data: ${ingredient.name}`);
    }
  }

  // Process ingredients in concurrent batches
  for (let i = 0; i < validatedIngredients.length; i += BATCH_SIZE) {
    const batch = validatedIngredients.slice(i, i + BATCH_SIZE);

    // Process batch concurrently
    const batchResults = await Promise.allSettled(
      batch.map(async (validatedIngredient) => {
        try {
          // Get nutrition data from enhanced provider (database-backed)
          const nutritionData = await dataProvider.getIngredientNutrition(
            validatedIngredient.name
          );

          return {
            ingredient: validatedIngredient,
            nutritionData,
          };
        } catch (error) {
          console.error(`Error processing ingredient:`, error);
          return {
            ingredient: validatedIngredient,
            nutritionData: null,
            error,
          };
        }
      })
    );

    // Aggregate results from this batch
    for (const result of batchResults) {
      if (result.status === "rejected") {
        warnings.push(`Failed to process batch ingredient: ${result.reason}`);
        continue;
      }

      const { ingredient: validatedIngredient, nutritionData } = result.value;

      if (nutritionData) {
        matchedIngredients++;

        // Track source
        switch (nutritionData.source) {
          case "local":
            localMatches++;
            break;
          case "usda":
            usdaMatches++;
            break;
          case "cache":
            cachedMatches++;
            break;
        }

        // Convert amounts to standard units and aggregate
        const standardizedNutrients = await standardizeNutrientAmounts(
          nutritionData.nutrients,
          validatedIngredient.amount,
          validatedIngredient.unit,
          validatedIngredient.name,
          warnings
        );

        aggregateNutrients(nutrientTotals, standardizedNutrients);
      } else {
        warnings.push(
          `No nutrition data found for: ${validatedIngredient.name}`
        );
      }
    }
  }

  // Convert map to array and sort by importance
  let totalNutrients = Array.from(nutrientTotals.values()).sort((a, b) => {
    // Sort by category and name
    const categoryOrder = [
      "Energy",
      "Macronutrients",
      "Vitamins",
      "Minerals",
      "Other",
    ];
    const catA = categoryOrder.indexOf(a.nutrient.nutrientCategory);
    const catB = categoryOrder.indexOf(b.nutrient.nutrientCategory);
    if (catA !== catB) return catA - catB;
    return a.nutrient.name.localeCompare(b.nutrient.name);
  });

  // Ensure basic nutrients are present (adds zero-value placeholders if missing)
  // Using centralized utility from nutrientFinder
  totalNutrients = ensureBasicNutrientsUtil(totalNutrients);

  // Calculate per-serving values
  const perServing = totalNutrients.map((nutrient) => ({
    ...nutrient,
    value: nutrient.value / opts.servings,
  }));

  // Calculate overall confidence
  const overallConfidence = calculateOverallConfidence(
    totalNutrients,
    matchedIngredients,
    ingredients.length
  );

  const result = {
    totalNutrients,
    perServing,
    servings: opts.servings,
    overallConfidence,
    metadata: {
      totalIngredients: ingredients.length,
      matchedIngredients,
      localMatches,
      usdaMatches,
      cachedMatches,
      warnings,
    },
  };

  // Cache the complete calculation in database for future use
  if (opts.useCache && matchedIngredients > 0) {
    await cacheNutritionCalculation(ingredients, opts.servings, result, {
      local: localMatches,
      usda: usdaMatches,
      cached: cachedMatches,
    }).catch((error) => {
      console.warn("Failed to cache nutrition calculation:", error);
    });
  }

  return result;
}

/**
 * Standardize nutrient amounts to common units
 * Converts ingredient amounts to per 100g basis for consistency
 * Now uses ingredient density data for accurate volume-to-weight conversions
 */
async function standardizeNutrientAmounts(
  nutrients: NutrientInfo[],
  amount: number,
  unit: string,
  ingredientName?: string,
  warnings?: string[]
): Promise<NutrientResult[]> {
  const standardized: NutrientResult[] = [];

  // Convert amount to grams using density data if available
  let amountInGrams = amount;
  let conversionConfidence = 1.0;

  try {
    // Use the new density-based conversion system with enhanced error handling
    if (unit !== "g" && unit !== "gram" && unit !== "grams") {
      const conversion = standardizeToGrams(
        amount,
        unit,
        ingredientName || "unknown"
      );
      amountInGrams = conversion.value;
      conversionConfidence = conversion.confidence;

      // Log warning if conversion had issues and add to warnings array
      if (conversion.warning) {
        console.warn(`Unit conversion warning: ${conversion.warning}`);
        if (warnings) {
          warnings.push(
            `Unit conversion issue for ${amount} ${unit}: ${conversion.warning}`
          );
        }
      }
    }
  } catch (error) {
    console.warn(`Could not convert ${amount} ${unit} to grams:`, error);
    if (warnings) {
      warnings.push(`Failed to convert ${amount} ${unit} to grams`);
    }
  }

  // Scale nutrients based on amount (nutrients are typically per 100g)
  const scaleFactor = amountInGrams / 100;

  for (const nutrient of nutrients) {
    const scaledValue = nutrient.value * scaleFactor;
    standardized.push({
      nutrient: {
        id: nutrient.id,
        name: nutrient.name,
        nutrientCategory: nutrient.category,
      },
      value: scaledValue,
      unit: nutrient.unit,
      percentDailyValue: nutrient.dailyValue
        ? (scaledValue / nutrient.dailyValue) * 100 // Fixed: divide by daily value, not multiply
        : undefined,
      confidence: nutrient.confidence * conversionConfidence, // Adjust confidence based on conversion accuracy
    });
  }

  return standardized;
}

// Removed estimateGramsFromVolume - now using ingredientDensity.ts for accurate conversions
// Removed ensureBasicNutrients - now using centralized utility from nutrientFinder.ts

/**
 * Aggregate nutrients from multiple sources
 */
function aggregateNutrients(
  totals: Map<string, NutrientResult>,
  nutrients: NutrientResult[]
) {
  for (const nutrient of nutrients) {
    const key = nutrient.nutrient.id;

    if (totals.has(key)) {
      const existing = totals.get(key)!;
      existing.value += nutrient.value;
      // Weighted average for confidence based on value contribution
      const totalValue = existing.value;
      const weight1 = (existing.value - nutrient.value) / totalValue;
      const weight2 = nutrient.value / totalValue;
      existing.confidence =
        existing.confidence * weight1 + nutrient.confidence * weight2;
    } else {
      // Clone the nutrient object to avoid mutations
      totals.set(key, { ...nutrient });
    }
  }
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
  nutrients: NutrientResult[],
  matchedIngredients: number,
  totalIngredients: number
): number {
  if (totalIngredients === 0) return 0;

  // Base confidence on ingredient coverage
  const coverageScore = (matchedIngredients / totalIngredients) * 100;

  // Average nutrient confidence scores
  const avgNutrientConfidence =
    nutrients.length > 0
      ? (nutrients.reduce((sum, n) => sum + n.confidence, 0) /
          nutrients.length) *
        100
      : 0;

  // Weighted average (60% coverage, 40% nutrient confidence)
  return Math.round(coverageScore * 0.6 + avgNutrientConfidence * 0.4);
}

// Removed duplicate parseIngredientString function
// Now using the comprehensive parseIngredient from @/utils/ingredientParser

// Removed findNutrientByIdOrName - now using centralized utility from nutrientFinder.ts

/**
 * Get summary nutrition facts (calories and macros)
 * Now using centralized utility from nutrientFinder.ts
 */
export function getSummaryNutrition(nutrients: NutrientResult[]): {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
} {
  return getSummaryNutritionUtil(nutrients);
}

/**
 * Batch calculate nutrition for multiple recipes
 * Useful for meal planning
 */
export async function batchCalculateNutrition(
  recipes: Array<{
    id: string;
    ingredients: IngredientInput[];
    servings?: number;
  }>,
  options: Partial<CalculationOptions> = {}
): Promise<Map<string, NutritionCalculationResult>> {
  const results = new Map<string, NutritionCalculationResult>();

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < recipes.length; i += BATCH_SIZE) {
    const batch = recipes.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (recipe) => {
        const result = await calculateNutrition(recipe.ingredients, {
          ...options,
          servings: recipe.servings || 1,
        });
        return { id: recipe.id, result };
      })
    );

    for (const { id, result } of batchResults) {
      results.set(id, result);
    }
  }

  return results;
}
