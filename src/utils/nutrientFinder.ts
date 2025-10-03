/**
 * Nutrient Finder Utility
 *
 * Centralized logic for finding nutrients by ID or name
 * with fallback strategies for robust matching.
 *
 * Uses nutrientDefinitions.ts as the single source of truth.
 */

import { NUTRIENT_DEFINITIONS } from "./nutrientDefinitions";

/**
 * Universal nutrient data interface
 * Works with both NutrientResult (server) and component types (client)
 */
export interface NutrientData {
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

/**
 * Find a nutrient by ID or name with fallback strategies
 *
 * @param nutrients - Array of nutrient data to search
 * @param ids - List of possible nutrient IDs to match
 * @param names - List of possible nutrient names to match
 * @param debug - Enable console logging for debugging
 * @returns Matched nutrient or undefined
 */
export function findNutrient(
  nutrients: NutrientData[],
  ids: string[],
  names: string[],
  debug = false
): NutrientData | undefined {
  // Strategy 1: Try matching by ID (most reliable)
  for (const id of ids) {
    // Normalize ID for comparison (remove prefix variations)
    const normalizedSearchId = id.replace(/^usda:/, "");

    const nutrient = nutrients.find((n) => {
      const normalizedNutrientId = n.nutrient.id.replace(/^usda:/, "");
      return (
        normalizedNutrientId === normalizedSearchId || n.nutrient.id === id
      );
    });

    if (nutrient && nutrient.value > 0) {
      if (debug) {
        console.log(
          `✓ Found nutrient by ID "${id}": ${nutrient.nutrient.name}`
        );
      }
      return nutrient;
    }
  }

  // Strategy 2: Try matching by name (fallback)
  for (const name of names) {
    const nutrient = nutrients.find((n) => {
      const nutrientName = n.nutrient.name.toLowerCase();
      const searchName = name.toLowerCase();
      const match =
        nutrientName === searchName ||
        nutrientName.includes(searchName) ||
        searchName.includes(nutrientName);
      return match;
    });
    if (nutrient && nutrient.value > 0) {
      if (debug) {
        console.log(
          `✓ Found nutrient by name "${name}": ${nutrient.nutrient.name}`
        );
      }
      return nutrient;
    }
  }

  if (debug) {
    console.log(
      `✗ No match found for IDs: [${ids.join(", ")}] or names: [${names.join(
        ", "
      )}]`
    );
  }

  return undefined;
}

/**
 * Find nutrient using the centralized definitions
 * Automatically uses all known ID and name variations
 */
export function findNutrientByKey(
  nutrients: NutrientData[],
  key: keyof typeof NUTRIENT_DEFINITIONS,
  debug = false
): NutrientData | undefined {
  const definition = NUTRIENT_DEFINITIONS[key];
  // Pass single ID as array for compatibility with findNutrient function
  return findNutrient(nutrients, [definition.id], definition.names, debug);
}

/**
 * Helper function to find all key macronutrients at once
 * Uses centralized definitions automatically
 */
export function findKeyMacros(nutrients: NutrientData[], debug = false) {
  return {
    calories: findNutrientByKey(nutrients, "ENERGY", debug),
    protein: findNutrientByKey(nutrients, "PROTEIN", debug),
    carbs: findNutrientByKey(nutrients, "CARBS", debug),
    fat: findNutrientByKey(nutrients, "FAT", debug),
    fiber: findNutrientByKey(nutrients, "FIBER", debug),
    sugar: findNutrientByKey(nutrients, "SUGAR", debug),
    sodium: findNutrientByKey(nutrients, "SODIUM", debug),
  };
}

/**
 * Get a summary of nutrition values for display
 * Returns rounded values ready for UI
 */
export function getSummaryNutrition(nutrients: NutrientData[]): {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
} {
  const macros = findKeyMacros(nutrients, false);

  return {
    calories: macros.calories ? Math.round(macros.calories.value) : undefined,
    protein: macros.protein
      ? Math.round(macros.protein.value * 10) / 10
      : undefined,
    carbs: macros.carbs ? Math.round(macros.carbs.value * 10) / 10 : undefined,
    fat: macros.fat ? Math.round(macros.fat.value * 10) / 10 : undefined,
    fiber: macros.fiber ? Math.round(macros.fiber.value * 10) / 10 : undefined,
    sugar: macros.sugar ? Math.round(macros.sugar.value * 10) / 10 : undefined,
    sodium: macros.sodium ? Math.round(macros.sodium.value) : undefined,
  };
}

/**
 * Calculate percent daily value for a nutrient
 */
export function calculatePercentDV(
  nutrientKey: keyof typeof NUTRIENT_DEFINITIONS,
  value: number
): number | undefined {
  const definition = NUTRIENT_DEFINITIONS[nutrientKey];
  if (!definition.dailyValue) return undefined;

  return (value / definition.dailyValue) * 100;
}

/**
 * Ensure a nutrient exists in the array, add with zero value if missing
 */
export function ensureNutrient(
  nutrients: NutrientData[],
  key: keyof typeof NUTRIENT_DEFINITIONS
): NutrientData[] {
  const definition = NUTRIENT_DEFINITIONS[key];

  // Check if nutrient already exists (by ID or name)
  const exists = findNutrientByKey(nutrients, key);
  if (exists) return nutrients;

  // Add with zero value
  return [
    ...nutrients,
    {
      nutrient: {
        id: definition.id,
        name: definition.name,
        nutrientCategory: definition.category,
      },
      value: 0,
      unit: definition.unit,
      percentDailyValue: 0,
      confidence: 0,
    },
  ];
}

/**
 * Ensure all basic macronutrients exist (for UI consistency)
 */
export function ensureBasicNutrients(
  nutrients: NutrientData[]
): NutrientData[] {
  let result = [...nutrients];

  // Ensure all key display nutrients exist
  const keys: Array<keyof typeof NUTRIENT_DEFINITIONS> = [
    "ENERGY",
    "PROTEIN",
    "CARBS",
    "FAT",
    "FIBER",
    "SUGAR",
    "SODIUM",
  ];

  for (const key of keys) {
    result = ensureNutrient(result, key);
  }

  return result;
}
