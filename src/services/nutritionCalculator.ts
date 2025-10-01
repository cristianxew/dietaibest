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
import convert from "convert-units";
import {
  getNutritionDataProvider,
  type NutrientInfo,
  NUTRIENT_IDS,
} from "./nutritionDataProvider";
import {
  cacheNutritionCalculation,
  getCachedNutritionCalculation,
} from "./ingredientNutritionDB";

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
  preferUSDA: z.boolean().default(false),
  includeConfidence: z.boolean().default(true),
});

export type IngredientInput = z.infer<typeof IngredientInputSchema>;
export type CalculationOptions = z.infer<typeof CalculationOptionsSchema>;

// Nutrient result structure
export interface NutrientResult {
  nutrient: {
    id: string;
    name: string;
    nutrientCategory: string;
  };
  value: number;
  unit: string;
  percentDailyValue?: number;
  confidence: number;
}

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

  for (const ingredient of ingredients) {
    try {
      // Validate input
      const validatedIngredient = IngredientInputSchema.parse(ingredient);

      // Get nutrition data from enhanced provider (database-backed)
      const nutritionData = await dataProvider.getIngredientNutrition(
        validatedIngredient.name
      );

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
          validatedIngredient.unit
        );

        aggregateNutrients(nutrientTotals, standardizedNutrients);
      } else {
        warnings.push(
          `No nutrition data found for: ${validatedIngredient.name}`
        );
      }
    } catch (error) {
      console.error(`Error processing ingredient:`, error);
      warnings.push(`Failed to process: ${ingredient.name}`);
    }
  }

  // Convert map to array and sort by importance
  const totalNutrients = Array.from(nutrientTotals.values()).sort((a, b) => {
    // Sort by category and name
    const categoryOrder = [
      "Energy",
      "Macronutrient",
      "Vitamin",
      "Mineral",
      "Other",
    ];
    const catA = categoryOrder.indexOf(a.nutrient.nutrientCategory);
    const catB = categoryOrder.indexOf(b.nutrient.nutrientCategory);
    if (catA !== catB) return catA - catB;
    return a.nutrient.name.localeCompare(b.nutrient.name);
  });

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
 */
async function standardizeNutrientAmounts(
  nutrients: NutrientInfo[],
  amount: number,
  unit: string
): Promise<NutrientResult[]> {
  const standardized: NutrientResult[] = [];

  // Convert amount to grams if possible
  let amountInGrams = amount;

  try {
    // Use convert-units library for standard conversions
    if (unit !== "g" && unit !== "gram" && unit !== "grams") {
      // Try mass conversion first
      try {
        const massUnits = ["mg", "kg", "oz", "lb"];
        const unitLower = unit.toLowerCase();

        if (massUnits.some((u) => unitLower.includes(u))) {
          // Map common variations to standard units
          let standardUnit = unitLower;
          if (unitLower.includes("ounce") || unitLower === "oz")
            standardUnit = "oz";
          if (
            unitLower.includes("pound") ||
            unitLower === "lb" ||
            unitLower === "lbs"
          )
            standardUnit = "lb";
          if (unitLower.includes("kilogram") || unitLower === "kg")
            standardUnit = "kg";
          if (unitLower.includes("milligram") || unitLower === "mg")
            standardUnit = "mg";

          // @ts-expect-error convert-units type definitions are incomplete
          amountInGrams = convert(amount).from(standardUnit).to("g");
        } else {
          // For volume units, use approximate conversions
          amountInGrams = estimateGramsFromVolume(amount, unit);
        }
      } catch {
        // If conversion fails, use the estimate function
        amountInGrams = estimateGramsFromVolume(amount, unit);
      }
    }
  } catch {
    console.warn(`Could not convert ${amount} ${unit} to grams, using as-is`);
  }

  // Scale nutrients based on amount (nutrients are typically per 100g)
  const scaleFactor = amountInGrams / 100;

  for (const nutrient of nutrients) {
    standardized.push({
      nutrient: {
        id: nutrient.id,
        name: nutrient.name,
        nutrientCategory: nutrient.category,
      },
      value: nutrient.value * scaleFactor,
      unit: nutrient.unit,
      percentDailyValue: nutrient.dailyValue
        ? (nutrient.value * scaleFactor * nutrient.dailyValue) / 100
        : undefined,
      confidence: nutrient.confidence,
    });
  }

  return standardized;
}

/**
 * Estimate grams from volume measurements
 * Uses average densities for common ingredients
 */
function estimateGramsFromVolume(amount: number, unit: string): number {
  const lowerUnit = unit.toLowerCase();

  // Convert to milliliters first
  let volumeInMl = amount;

  if (lowerUnit.includes("cup")) {
    volumeInMl = amount * 236.588;
  } else if (lowerUnit.includes("tbsp") || lowerUnit.includes("tablespoon")) {
    volumeInMl = amount * 14.787;
  } else if (lowerUnit.includes("tsp") || lowerUnit.includes("teaspoon")) {
    volumeInMl = amount * 4.929;
  } else if (lowerUnit === "l" || lowerUnit.includes("liter")) {
    volumeInMl = amount * 1000;
  } else if (lowerUnit === "ml" || lowerUnit.includes("milliliter")) {
    volumeInMl = amount;
  } else if (lowerUnit.includes("fl oz") || lowerUnit.includes("fluid ounce")) {
    volumeInMl = amount * 29.574;
  } else if (lowerUnit.includes("pint")) {
    volumeInMl = amount * 473.176;
  } else if (lowerUnit.includes("quart")) {
    volumeInMl = amount * 946.353;
  } else if (lowerUnit.includes("gallon")) {
    volumeInMl = amount * 3785.41;
  }

  // Use average density of 1g/ml (like water)
  // This is a rough approximation - could be enhanced with ingredient-specific densities
  return volumeInMl;
}

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

/**
 * Parse ingredient string to extract amount, unit, and name
 * This is a simplified version - can be enhanced with NLP
 */
export function parseIngredientString(text: string): IngredientInput | null {
  try {
    // Remove extra whitespace and normalize
    const cleaned = text.trim().replace(/\s+/g, " ");

    // Common patterns for ingredient strings
    const patterns = [
      // "2 cups flour", "1.5 tbsp olive oil"
      /^(\d+\.?\d*)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(.+)$/,
      // "250g chicken", "500ml milk"
      /^(\d+\.?\d*)([a-zA-Z]+)\s+(.+)$/,
      // "1/2 cup sugar", "3/4 tsp salt"
      /^(\d+\/\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(.+)$/,
    ];

    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        let [, amountStr] = match;
        const [, , unitStr, nameStr] = match;
        const unit = unitStr;
        const name = nameStr;

        // Handle fractions
        if (amountStr.includes("/")) {
          const [numerator, denominator] = amountStr.split("/").map(Number);
          amountStr = (numerator / denominator).toString();
        }

        return {
          amount: parseFloat(amountStr),
          unit: unit.toLowerCase().trim(),
          name: name.trim(),
        };
      }
    }

    // If no pattern matches, try to extract just a number at the beginning
    const simpleMatch = cleaned.match(/^(\d+\.?\d*)\s+(.+)$/);
    if (simpleMatch) {
      const [, amountStr, rest] = simpleMatch;
      return {
        amount: parseFloat(amountStr),
        unit: "piece",
        name: rest.trim(),
      };
    }

    // If no amount found, assume 1 piece
    return {
      amount: 1,
      unit: "piece",
      name: cleaned,
    };
  } catch (error) {
    console.error("Error parsing ingredient:", error);
    return null;
  }
}
/**
 * Get summary nutrition facts (calories and macros)
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
  const summary: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
  } = {};

  for (const nutrient of nutrients) {
    const id = nutrient.nutrient.id;
    const name = nutrient.nutrient.name.toLowerCase();

    if (
      id === NUTRIENT_IDS.ENERGY ||
      name.includes("energy") ||
      name.includes("calorie")
    ) {
      summary.calories = Math.round(nutrient.value);
    } else if (id === NUTRIENT_IDS.PROTEIN || name.includes("protein")) {
      summary.protein = Math.round(nutrient.value * 10) / 10;
    } else if (id === NUTRIENT_IDS.CARBS || name.includes("carbohydrate")) {
      summary.carbs = Math.round(nutrient.value * 10) / 10;
    } else if (
      id === NUTRIENT_IDS.FAT ||
      (name.includes("fat") && name.includes("total"))
    ) {
      summary.fat = Math.round(nutrient.value * 10) / 10;
    } else if (id === NUTRIENT_IDS.FIBER || name.includes("fiber")) {
      summary.fiber = Math.round(nutrient.value * 10) / 10;
    } else if (id === NUTRIENT_IDS.SUGAR || name.includes("sugar")) {
      summary.sugar = Math.round(nutrient.value * 10) / 10;
    } else if (id === NUTRIENT_IDS.SODIUM || name.includes("sodium")) {
      summary.sodium = Math.round(nutrient.value);
    }
  }

  return summary;
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
