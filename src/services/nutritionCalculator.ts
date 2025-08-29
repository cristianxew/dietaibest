/**
 * Nutrition Calculation Engine
 *
 * This service calculates nutritional information for recipes based on:
 * - Ingredient nutritional data from the database
 * - Ingredient quantities and units
 * - Serving sizes and portions
 * - Unit conversions (metric/imperial)
 *
 * Features:
 * - Nutrient scaling based on quantities
 * - Unit conversion system
 * - Portion size calculations
 * - Daily value percentages
 * - Precision handling for small quantities
 */

import { Ingredient, IngredientNutrient, Nutrient } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { ParsedIngredient } from "@/utils/ingredientParser";
import { fuzzyMatchIngredient, IngredientMatch } from "@/utils/fuzzyMatcher";
import {
  getCachedIngredientNutrition,
  cacheIngredientNutrition,
  getCachedRecipeNutrition,
  cacheRecipeNutrition,
} from "@/services/nutritionCache";

// Unit conversion constants
const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  // Volume conversions to milliliters
  volume: {
    ml: 1,
    milliliter: 1,
    liter: 1000,
    l: 1000,
    cup: 236.588,
    tablespoon: 14.787,
    tbsp: 14.787,
    teaspoon: 4.929,
    tsp: 4.929,
    "fl oz": 29.574,
    "fluid ounce": 29.574,
    pint: 473.176,
    pt: 473.176,
    quart: 946.353,
    qt: 946.353,
    gallon: 3785.41,
    gal: 3785.41,
  },

  // Weight conversions to grams
  weight: {
    g: 1,
    gram: 1,
    kg: 1000,
    kilogram: 1000,
    mg: 0.001,
    milligram: 0.001,
    oz: 28.3495,
    ounce: 28.3495,
    lb: 453.592,
    pound: 453.592,
  },

  // Count-based units (no conversion needed)
  count: {
    piece: 1,
    slice: 1,
    clove: 1,
    bunch: 1,
    can: 1,
    package: 1,
    stick: 1,
    head: 1,
    sprig: 1,
    pinch: 0.25, // Approximate as 1/4 tsp
    dash: 0.125, // Approximate as 1/8 tsp
  },
};

// Common ingredient densities (g/ml) for volume to weight conversion
const INGREDIENT_DENSITIES: Record<string, number> = {
  water: 1.0,
  milk: 1.03,
  cream: 0.994,
  "heavy cream": 0.994,
  flour: 0.593,
  "all-purpose flour": 0.593,
  "bread flour": 0.55,
  sugar: 0.845,
  "granulated sugar": 0.845,
  "brown sugar": 0.93,
  "powdered sugar": 0.56,
  salt: 1.217,
  butter: 0.911,
  oil: 0.92,
  "olive oil": 0.915,
  "vegetable oil": 0.92,
  honey: 1.42,
  "maple syrup": 1.37,
};

export interface NutrientValue {
  nutrient: Nutrient;
  value: number;
  unit: string;
  percentDailyValue?: number;
  confidence: number; // 0-1 confidence in the calculation
}

export interface IngredientNutrition {
  ingredient: Ingredient;
  parsedIngredient: ParsedIngredient;
  matchedIngredient?: IngredientMatch;
  quantityInGrams: number;
  nutrients: NutrientValue[];
  warnings: string[];
}

export interface RecipeNutrition {
  totalNutrients: NutrientValue[];
  perServing: NutrientValue[];
  ingredientBreakdown: IngredientNutrition[];
  servings: number;
  warnings: string[];
  overallConfidence: number;
}

export interface CalculationOptions {
  servings?: number; // Default: 1
  includePercentDV?: boolean; // Default: true
  fuzzyMatchThreshold?: number; // Default: 0.7
  useSubstitutions?: boolean; // Default: false
}

const DEFAULT_CALCULATION_OPTIONS: Required<CalculationOptions> = {
  servings: 1,
  includePercentDV: true,
  fuzzyMatchThreshold: 0.7,
  useSubstitutions: false,
};

/**
 * Convert a quantity and unit to grams
 */
function convertToGrams(
  quantity: number,
  unit: string | null,
  ingredientName: string
): { grams: number; confidence: number; warning?: string } {
  if (!unit) {
    // No unit, assume it's already in a standard form or count-based
    return {
      grams: quantity * 100, // Assume 100g per unit for unknown items
      confidence: 0.5,
      warning: "No unit specified, assuming 100g per unit",
    };
  }

  // Check if it's a weight unit
  const weightConversion = UNIT_CONVERSIONS.weight[unit.toLowerCase()];
  if (weightConversion !== undefined) {
    return {
      grams: quantity * weightConversion,
      confidence: 1.0,
    };
  }

  // Check if it's a volume unit
  const volumeConversion = UNIT_CONVERSIONS.volume[unit.toLowerCase()];
  if (volumeConversion !== undefined) {
    // Convert volume to ml first
    const ml = quantity * volumeConversion;

    // Try to find density for this ingredient
    const normalizedName = ingredientName.toLowerCase();
    let density = 1.0; // Default to water density
    let confidence = 0.7;

    // Look for exact or partial matches in density table
    for (const [key, value] of Object.entries(INGREDIENT_DENSITIES)) {
      if (normalizedName.includes(key) || key.includes(normalizedName)) {
        density = value;
        confidence = 0.9;
        break;
      }
    }

    return {
      grams: ml * density,
      confidence,
      warning:
        confidence < 0.9
          ? "Using estimated density for volume conversion"
          : undefined,
    };
  }

  // Check if it's a count-based unit
  const countConversion = UNIT_CONVERSIONS.count[unit.toLowerCase()];
  if (countConversion !== undefined) {
    // For count-based units, we need to estimate weight
    // This is highly ingredient-dependent
    const estimatedGrams = quantity * countConversion * 50; // Very rough estimate
    return {
      grams: estimatedGrams,
      confidence: 0.3,
      warning: `Count-based unit "${unit}" requires specific ingredient data for accurate conversion`,
    };
  }

  // Unknown unit
  return {
    grams: quantity * 100, // Fallback assumption
    confidence: 0.2,
    warning: `Unknown unit "${unit}", using rough estimate`,
  };
}

/**
 * Fetch nutritional data for an ingredient from the database with caching
 */
async function fetchIngredientNutrition(
  ingredientId: string
): Promise<(IngredientNutrient & { nutrient: Nutrient })[]> {
  // Check cache first
  const cachedNutrition = await getCachedIngredientNutrition(ingredientId);
  if (cachedNutrition) {
    return cachedNutrition;
  }

  // If not in cache, fetch from database
  const nutrition = await prisma.ingredientNutrient.findMany({
    where: { ingredientId },
    include: {
      nutrient: true,
    },
  });

  // Cache the result
  await cacheIngredientNutrition(ingredientId, nutrition);

  return nutrition;
}

/**
 * Calculate nutritional values for a single ingredient
 */
async function calculateIngredientNutrition(
  parsedIngredient: ParsedIngredient,
  allIngredients: Ingredient[],
  options: Required<CalculationOptions>
): Promise<IngredientNutrition> {
  const warnings: string[] = [];

  // Try to match the ingredient in the database
  const matches = await fuzzyMatchIngredient(
    parsedIngredient.name,
    allIngredients,
    {
      threshold: options.fuzzyMatchThreshold,
      includeSubstitutions: options.useSubstitutions,
      maxResults: 1,
    }
  );

  if (matches.length === 0) {
    warnings.push(`No match found for ingredient "${parsedIngredient.name}"`);
    return {
      ingredient: {} as Ingredient, // Empty ingredient
      parsedIngredient,
      quantityInGrams: 0,
      nutrients: [],
      warnings,
    };
  }

  const matchedIngredient = matches[0];
  const ingredient = matchedIngredient.ingredient;

  // Add warning if match confidence is low
  if (matchedIngredient.confidence === "low") {
    warnings.push(
      `Low confidence match: "${parsedIngredient.name}" → "${ingredient.name}"`
    );
  }

  // Convert quantity to grams
  const quantity = parsedIngredient.quantity || 1;
  const conversionResult = convertToGrams(
    quantity,
    parsedIngredient.unit,
    ingredient.name
  );

  if (conversionResult.warning) {
    warnings.push(conversionResult.warning);
  }

  // Fetch nutritional data
  const ingredientNutrients = await fetchIngredientNutrition(ingredient.id);

  // Calculate scaled nutrient values
  const nutrients: NutrientValue[] = ingredientNutrients.map((ingNutrient) => {
    // Nutritional values are stored per 100g
    const scaleFactor = conversionResult.grams / 100;
    const scaledValue = ingNutrient.value * scaleFactor;

    // Calculate confidence based on various factors
    const confidence =
      matchedIngredient.score *
      conversionResult.confidence *
      ingNutrient.confidence;

    const nutrientValue: NutrientValue = {
      nutrient: ingNutrient.nutrient,
      value: scaledValue,
      unit: ingNutrient.nutrient.unit,
      confidence,
    };

    // Calculate percent daily value if enabled and available
    if (options.includePercentDV && ingNutrient.nutrient.dailyValue) {
      nutrientValue.percentDailyValue =
        (scaledValue / ingNutrient.nutrient.dailyValue) * 100;
    }

    return nutrientValue;
  });

  return {
    ingredient,
    parsedIngredient,
    matchedIngredient,
    quantityInGrams: conversionResult.grams,
    nutrients,
    warnings,
  };
}

/**
 * Aggregate nutrients from multiple ingredients
 */
function aggregateNutrients(
  ingredientNutritions: IngredientNutrition[]
): NutrientValue[] {
  const nutrientMap = new Map<string, NutrientValue>();

  for (const ingNutrition of ingredientNutritions) {
    for (const nutrientValue of ingNutrition.nutrients) {
      const nutrientId = nutrientValue.nutrient.id;

      if (nutrientMap.has(nutrientId)) {
        // Aggregate existing nutrient
        const existing = nutrientMap.get(nutrientId)!;
        existing.value += nutrientValue.value;

        // Update confidence (weighted average)
        const totalValue = existing.value + nutrientValue.value;
        existing.confidence =
          (existing.confidence * existing.value +
            nutrientValue.confidence * nutrientValue.value) /
          totalValue;

        // Update percent daily value
        if (
          existing.percentDailyValue !== undefined &&
          nutrientValue.percentDailyValue !== undefined
        ) {
          existing.percentDailyValue += nutrientValue.percentDailyValue;
        }
      } else {
        // New nutrient
        nutrientMap.set(nutrientId, { ...nutrientValue });
      }
    }
  }

  return Array.from(nutrientMap.values());
}

/**
 * Main function to calculate nutrition for a recipe
 */
export async function calculateRecipeNutrition(
  parsedIngredients: ParsedIngredient[],
  options: CalculationOptions = {}
): Promise<RecipeNutrition> {
  const opts = { ...DEFAULT_CALCULATION_OPTIONS, ...options };

  // Check cache first
  const cachedNutrition = await getCachedRecipeNutrition(
    parsedIngredients,
    opts.servings
  );
  if (cachedNutrition) {
    return cachedNutrition;
  }

  const warnings: string[] = [];

  // Fetch all ingredients from database for matching
  const allIngredients = await prisma.ingredient.findMany();

  // Calculate nutrition for each ingredient
  const ingredientNutritions = await Promise.all(
    parsedIngredients.map((parsed) =>
      calculateIngredientNutrition(parsed, allIngredients, opts)
    )
  );

  // Collect all warnings
  for (const ingNutrition of ingredientNutritions) {
    warnings.push(...ingNutrition.warnings);
  }

  // Aggregate total nutrients
  const totalNutrients = aggregateNutrients(ingredientNutritions);

  // Calculate per-serving nutrients
  const perServing = totalNutrients.map((nutrient) => ({
    ...nutrient,
    value: nutrient.value / opts.servings,
    percentDailyValue: nutrient.percentDailyValue
      ? nutrient.percentDailyValue / opts.servings
      : undefined,
  }));

  // Calculate overall confidence
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const ingNutrition of ingredientNutritions) {
    for (const nutrient of ingNutrition.nutrients) {
      totalConfidence += nutrient.confidence;
      confidenceCount++;
    }
  }

  const overallConfidence =
    confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  const result: RecipeNutrition = {
    totalNutrients,
    perServing,
    ingredientBreakdown: ingredientNutritions,
    servings: opts.servings,
    warnings,
    overallConfidence,
  };

  // Cache the result
  await cacheRecipeNutrition(parsedIngredients, result, opts.servings);

  return result;
}

/**
 * Get nutritional information for a single ingredient
 */
export async function getIngredientNutrition(
  ingredientId: string,
  quantityInGrams: number = 100
): Promise<NutrientValue[]> {
  const ingredientNutrients = await fetchIngredientNutrition(ingredientId);

  return ingredientNutrients.map((ingNutrient) => {
    const scaleFactor = quantityInGrams / 100;
    const scaledValue = ingNutrient.value * scaleFactor;

    const nutrientValue: NutrientValue = {
      nutrient: ingNutrient.nutrient,
      value: scaledValue,
      unit: ingNutrient.nutrient.unit,
      confidence: ingNutrient.confidence,
    };

    if (ingNutrient.nutrient.dailyValue) {
      nutrientValue.percentDailyValue =
        (scaledValue / ingNutrient.nutrient.dailyValue) * 100;
    }

    return nutrientValue;
  });
}

/**
 * Format nutrient value for display
 */
export function formatNutrientValue(nutrient: NutrientValue): string {
  const { value, unit } = nutrient;

  // Format based on the magnitude of the value
  if (value === 0) {
    return `0${unit}`;
  } else if (value < 0.01) {
    return `< 0.01${unit}`;
  } else if (value < 1) {
    return `${value.toFixed(2)}${unit}`;
  } else if (value < 10) {
    return `${value.toFixed(1)}${unit}`;
  } else {
    return `${Math.round(value)}${unit}`;
  }
}

/**
 * Group nutrients by category for display
 */
export function groupNutrientsByCategory(
  nutrients: NutrientValue[]
): Record<string, NutrientValue[]> {
  const grouped: Record<string, NutrientValue[]> = {};

  for (const nutrient of nutrients) {
    const category = nutrient.nutrient.nutrientCategory;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(nutrient);
  }

  // Sort within each category by display order
  for (const category of Object.keys(grouped)) {
    grouped[category].sort(
      (a, b) => a.nutrient.displayOrder - b.nutrient.displayOrder
    );
  }

  return grouped;
}
