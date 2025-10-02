/**
 * Ingredient Density Data and Conversion Utilities
 *
 * This module provides density data for common ingredients to enable
 * accurate volume-to-weight conversions. Densities are stored as
 * grams per cup (US cup = 240ml) for consistency.
 *
 * Enhanced with convert-units library for better unit support and validation.
 *
 * Sources:
 * - USDA National Nutrient Database
 * - King Arthur Flour Ingredient Weight Chart
 * - Professional cooking references
 */

import convert, { Unit } from "convert-units";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Supported mass units for nutrition calculations
 */
export type MassUnit = "g" | "kg" | "mg" | "oz" | "lb";

/**
 * Supported volume units for nutrition calculations
 */
export type VolumeUnit = "ml" | "l" | "cup" | "tbsp" | "tsp" | "fl-oz";

/**
 * All supported nutrition units
 */
export type NutritionUnit = MassUnit | VolumeUnit;

/**
 * Measurement system preference
 */
export type MeasurementSystem = "metric" | "imperial";

/**
 * Unit validation result
 */
export interface UnitValidation {
  isValid: boolean;
  measure?: "mass" | "volume";
  suggestions?: string[];
}

/**
 * Ingredient density in grams per US cup (240ml)
 * For solids, this is the typical packed/scooped density
 */
export const INGREDIENT_DENSITIES: Record<string, number> = {
  // Flours (grams per cup)
  flour: 120,
  "all-purpose flour": 120,
  "all purpose flour": 120,
  "bread flour": 127,
  "whole wheat flour": 128,
  "whole-wheat flour": 128,
  "cake flour": 114,
  "pastry flour": 106,
  "self-rising flour": 120,
  "self rising flour": 120,
  "almond flour": 96,
  "coconut flour": 128,
  "rice flour": 158,
  cornmeal: 138,
  cornstarch: 128,
  "corn starch": 128,

  // Sugars and Sweeteners (grams per cup)
  sugar: 200,
  "granulated sugar": 200,
  "white sugar": 200,
  "brown sugar": 220,
  "light brown sugar": 217,
  "dark brown sugar": 223,
  "powdered sugar": 120,
  "confectioners sugar": 120,
  "confectioners' sugar": 120,
  "icing sugar": 120,
  honey: 340,
  "maple syrup": 315,
  "corn syrup": 328,
  molasses: 337,

  // Fats and Oils (grams per cup)
  butter: 227,
  margarine: 227,
  oil: 218,
  "vegetable oil": 218,
  "olive oil": 216,
  "coconut oil": 218,
  shortening: 191,
  lard: 205,
  "peanut butter": 258,
  "almond butter": 250,

  // Dairy (grams per cup)
  milk: 244,
  "whole milk": 244,
  "skim milk": 245,
  "2% milk": 244,
  cream: 238,
  "heavy cream": 238,
  "light cream": 240,
  "half and half": 242,
  "half-and-half": 242,
  "sour cream": 230,
  yogurt: 245,
  "greek yogurt": 285,
  "cottage cheese": 225,
  "ricotta cheese": 250,
  "cream cheese": 232,
  "shredded cheese": 113,
  "grated cheese": 100,
  "grated parmesan": 100,

  // Proteins (grams per cup, diced/chopped)
  chicken: 140,
  "chicken breast": 140,
  "chicken thigh": 135,
  "ground chicken": 200,
  beef: 150,
  "ground beef": 225,
  "ground turkey": 200,
  "ground pork": 210,
  pork: 145,
  fish: 134,
  salmon: 134,
  tuna: 154,
  shrimp: 134,
  eggs: 243, // beaten eggs
  tofu: 248,

  // Grains and Pasta (grams per cup, uncooked)
  rice: 185,
  "white rice": 185,
  "brown rice": 195,
  "wild rice": 160,
  quinoa: 170,
  oats: 80,
  "rolled oats": 80,
  "instant oats": 75,
  barley: 200,
  pasta: 100, // dry pasta shapes
  macaroni: 105,
  penne: 100,
  spaghetti: 95, // broken pieces
  breadcrumbs: 108,
  "bread crumbs": 108,
  panko: 50,

  // Nuts and Seeds (grams per cup, whole)
  almonds: 143,
  walnuts: 117,
  pecans: 109,
  cashews: 137,
  peanuts: 146,
  "sunflower seeds": 140,
  "pumpkin seeds": 129,
  "chia seeds": 160,
  "flax seeds": 168,
  "sesame seeds": 136,

  // Vegetables (grams per cup, chopped/diced)
  onion: 160,
  onions: 160,
  garlic: 136,
  carrots: 128,
  carrot: 128,
  celery: 101,
  "bell pepper": 149,
  "bell peppers": 149,
  tomatoes: 180,
  tomato: 180,
  cucumber: 104,
  lettuce: 36,
  spinach: 30,
  kale: 16,
  broccoli: 91,
  cauliflower: 107,
  corn: 145,
  peas: 145,
  "green beans": 110,
  mushrooms: 70,
  potato: 150,
  potatoes: 150,
  "sweet potato": 133,
  "sweet potatoes": 133,

  // Fruits (grams per cup)
  apples: 110,
  apple: 110,
  bananas: 225,
  banana: 225,
  berries: 145,
  strawberries: 144,
  blueberries: 148,
  raspberries: 123,
  blackberries: 144,
  grapes: 92,
  orange: 180,
  oranges: 180,
  "lemon juice": 244,
  "lime juice": 246,

  // Baking ingredients (grams per cup)
  "cocoa powder": 86,
  cocoa: 86,
  "chocolate chips": 170,
  "baking soda": 220,
  "baking powder": 220,
  yeast: 160, // active dry
  gelatin: 128,
  salt: 273,
  "table salt": 273,
  "kosher salt": 137,
  "sea salt": 250,

  // Liquids (grams per cup)
  water: 237,
  broth: 240,
  stock: 240,
  wine: 235,
  beer: 245,
  vinegar: 238,
  "soy sauce": 255,

  // Common ingredients with variable density
  beans: 180, // cooked
  "black beans": 172,
  "kidney beans": 177,
  chickpeas: 164,
  lentils: 192,
};

// ============================================================================
// UNIT VALIDATION AND DISCOVERY FUNCTIONS
// ============================================================================

/**
 * Check if a unit is valid for a given measure type
 */
export function isValidUnit(unit: string, measure: "mass" | "volume"): boolean {
  try {
    const unitInfo = convert().describe(unit as Unit);
    return unitInfo.measure === measure;
  } catch {
    return false;
  }
}

/**
 * Validate a unit and get detailed information
 */
export function validateUnit(unit: string): UnitValidation {
  try {
    const unitInfo = convert().describe(unit as Unit);
    const suggestions = unitInfo.measure ? [] : getUnitSuggestions(unit);

    return {
      isValid: true,
      measure: unitInfo.measure as "mass" | "volume",
      suggestions,
    };
  } catch {
    return {
      isValid: false,
      suggestions: getUnitSuggestions(unit),
    };
  }
}

/**
 * Get all available units for a given measure type
 */
export function getAvailableUnits(measure: "mass" | "volume"): string[] {
  try {
    if (measure === "mass") {
      return convert().from("g").possibilities();
    }
    return convert().from("ml").possibilities();
  } catch {
    return [];
  }
}

/**
 * Get detailed information about a unit
 */
export function getUnitInfo(unit: string) {
  try {
    return convert().describe(unit as Unit);
  } catch {
    return null;
  }
}

/**
 * Get unit suggestions for invalid units using string similarity
 */
export function getUnitSuggestions(invalidUnit: string): string[] {
  const allUnits = convert().possibilities();
  const normalized = invalidUnit.toLowerCase();

  // Find similar units using string similarity
  return allUnits.filter((unit) => {
    const unitLower = unit.toLowerCase();
    return (
      unitLower.includes(normalized) ||
      normalized.includes(unitLower) ||
      levenshteinDistance(normalized, unitLower) <= 2
    );
  });
}

/**
 * Calculate Levenshtein distance for string similarity
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array(b.length + 1)
    .fill(null)
    .map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Format unit for user-friendly display
 */
export function formatUnitDisplay(
  unit: string,
  plural: boolean = false
): string {
  try {
    const info = convert().describe(unit as Unit);
    return plural ? info.plural : info.singular;
  } catch {
    return unit;
  }
}

/**
 * Convert value to preferred measurement system
 */
export function convertToPreferredSystem(
  value: number,
  unit: string,
  preferredSystem: "metric" | "imperial"
): { value: number; unit: string } {
  const unitInfo = convert().describe(unit as Unit);

  if (unitInfo.measure === "mass") {
    const targetUnit = preferredSystem === "metric" ? "g" : "oz";
    try {
      return {
        value: convert(value)
          .from(unit as Unit)
          .to(targetUnit),
        unit: targetUnit,
      };
    } catch {
      return { value, unit };
    }
  }

  if (unitInfo.measure === "volume") {
    const targetUnit = preferredSystem === "metric" ? "ml" : "fl-oz";
    try {
      return {
        value: convert(value)
          .from(unit as Unit)
          .to(targetUnit),
        unit: targetUnit,
      };
    } catch {
      return { value, unit };
    }
  }

  return { value, unit };
}

/**
 * Get preferred units for a measurement system
 */
export function getPreferredUnits(
  measure: "mass" | "volume",
  system: "metric" | "imperial"
): string[] {
  if (measure === "mass") {
    return system === "metric" ? ["g", "kg", "mg"] : ["oz", "lb"];
  }

  return system === "metric" ? ["ml", "l"] : ["fl-oz", "cup", "tsp", "tbsp"];
}

/**
 * Convert volume to cups using convert-units
 * Replaces the deprecated VOLUME_TO_CUPS map
 */
export function volumeToCups(amount: number, unit: string): number | null {
  try {
    // convert-units uses 'cup' as a standard volume unit
    return convert(amount)
      .from(unit as Unit)
      .to("cup");
  } catch {
    return null;
  }
}

/**
 * Convert volume to milliliters using convert-units
 */
export function volumeToMilliliters(
  amount: number,
  unit: string
): number | null {
  try {
    return convert(amount)
      .from(unit as Unit)
      .to("ml");
  } catch {
    return null;
  }
}

/**
 * Convert weight to grams using convert-units
 * Replaces the deprecated WEIGHT_TO_GRAMS map
 */
export function weightToGrams(amount: number, unit: string): number | null {
  try {
    return convert(amount)
      .from(unit as Unit)
      .to("g");
  } catch {
    return null;
  }
}

/**
 * Standardize weight to grams with enhanced error handling
 */
export function standardizeWeightToGrams(
  amount: number,
  unit: string
): ConversionResult {
  try {
    // Try direct weight conversion with convert-units
    const grams = convert(amount)
      .from(unit as Unit)
      .to("g");
    return {
      value: grams,
      unit: "g",
      confidence: 1.0,
      method: "direct",
    };
  } catch {
    return {
      value: amount,
      unit: unit,
      confidence: 0,
      method: "fallback",
      warning: `Unsupported weight unit: ${unit}`,
    };
  }
}

// ============================================================================
// DEPRECATED FUNCTIONS - Use convert-units functions above instead
// ============================================================================

// Note: VOLUME_TO_CUPS and WEIGHT_TO_GRAMS maps have been removed.
// Use volumeToCups() and weightToGrams() functions instead.

export interface ConversionResult {
  value: number;
  unit: string;
  confidence: number;
  method: "direct" | "density" | "fallback";
  warning?: string;
}

/**
 * Get density for an ingredient (grams per cup)
 */
export function getIngredientDensity(ingredientName: string): number | null {
  const normalized = ingredientName.toLowerCase().trim();

  // Direct match
  if (INGREDIENT_DENSITIES[normalized]) {
    return INGREDIENT_DENSITIES[normalized];
  }

  // Partial match - check if the ingredient name contains a known ingredient
  for (const [key, density] of Object.entries(INGREDIENT_DENSITIES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return density;
    }
  }

  return null;
}

/**
 * Convert volume to weight using ingredient density
 */
export function volumeToWeight(
  amount: number,
  volumeUnit: string,
  ingredientName: string
): ConversionResult {
  const normalizedUnit = volumeUnit.toLowerCase().trim();

  // Check if it's already a weight unit (shouldn't be here, but handle gracefully)
  try {
    const grams = convert(amount)
      .from(normalizedUnit as Unit)
      .to("g");
    return {
      value: grams,
      unit: "g",
      confidence: 1.0,
      method: "direct",
    };
  } catch {
    // Not a weight unit, continue
  }

  // Convert volume to cups using convert-units
  let cups: number;
  try {
    cups = convert(amount)
      .from(normalizedUnit as Unit)
      .to("cup");
  } catch {
    return {
      value: amount,
      unit: volumeUnit,
      confidence: 0,
      method: "fallback",
      warning: `Unknown volume unit: ${volumeUnit}`,
    };
  }

  // Get ingredient density
  const density = getIngredientDensity(ingredientName);
  if (!density) {
    // Use average density as fallback (water)
    const avgDensity = 240;
    return {
      value: cups * avgDensity,
      unit: "g",
      confidence: 0.5,
      method: "fallback",
      warning: `No density data for ${ingredientName}, using average density`,
    };
  }

  // Calculate weight in grams
  const grams = cups * density;

  return {
    value: grams,
    unit: "g",
    confidence: 0.95,
    method: "density",
  };
}

/**
 * Convert weight to volume using ingredient density
 */
export function weightToVolume(
  amount: number,
  weightUnit: string,
  ingredientName: string,
  targetVolumeUnit: string = "cup"
): ConversionResult {
  const normalizedWeightUnit = weightUnit.toLowerCase().trim();
  const normalizedVolumeUnit = targetVolumeUnit.toLowerCase().trim();

  // Check if it's already a volume unit (shouldn't be here, but handle gracefully)
  try {
    const volumeValue = convert(amount)
      .from(normalizedWeightUnit as Unit)
      .to(normalizedVolumeUnit as Unit);
    return {
      value: volumeValue,
      unit: targetVolumeUnit,
      confidence: 1.0,
      method: "direct",
    };
  } catch {
    // Not a volume unit, continue
  }

  // Get grams conversion using convert-units
  let grams: number;
  try {
    grams = convert(amount)
      .from(normalizedWeightUnit as Unit)
      .to("g");
  } catch {
    return {
      value: amount,
      unit: weightUnit,
      confidence: 0,
      method: "fallback",
      warning: `Unknown weight unit: ${weightUnit}`,
    };
  }

  // Get ingredient density
  const density = getIngredientDensity(ingredientName);
  if (!density) {
    // Use average density as fallback
    const avgDensity = 240; // grams per cup
    const cups = grams / avgDensity;

    // Convert to target volume unit
    try {
      const targetVolume = convert(cups)
        .from("cup")
        .to(normalizedVolumeUnit as Unit);
      return {
        value: targetVolume,
        unit: targetVolumeUnit,
        confidence: 0.5,
        method: "fallback",
        warning: `No density data for ${ingredientName}, using average density`,
      };
    } catch {
      return {
        value: cups,
        unit: "cup",
        confidence: 0.5,
        method: "fallback",
        warning: `No density data for ${ingredientName}, using average density`,
      };
    }
  }

  // Calculate volume
  const cups = grams / density;

  // Convert to target volume unit
  try {
    const targetVolume = convert(cups)
      .from("cup")
      .to(normalizedVolumeUnit as Unit);
    return {
      value: targetVolume,
      unit: targetVolumeUnit,
      confidence: 0.95,
      method: "density",
    };
  } catch {
    return {
      value: cups,
      unit: "cup",
      confidence: 0.95,
      method: "density",
    };
  }
}

/**
 * Check if a unit is a volume unit using convert-units
 */
export function isVolumeUnit(unit: string): boolean {
  try {
    const unitInfo = convert().describe(unit as Unit);
    return unitInfo.measure === "volume";
  } catch {
    return false;
  }
}

/**
 * Check if a unit is a weight unit using convert-units
 */
export function isWeightUnit(unit: string): boolean {
  try {
    const unitInfo = convert().describe(unit as Unit);
    return unitInfo.measure === "mass";
  } catch {
    return false;
  }
}

/**
 * Standardize any unit to grams for database storage
 */
export function standardizeToGrams(
  amount: number,
  unit: string,
  ingredientName: string
): ConversionResult {
  const normalized = unit.toLowerCase().trim();

  // Already in grams
  if (normalized === "g" || normalized === "gram" || normalized === "grams") {
    return {
      value: amount,
      unit: "g",
      confidence: 1.0,
      method: "direct",
    };
  }

  // Try direct weight conversion with convert-units
  try {
    const grams = convert(amount)
      .from(normalized as Unit)
      .to("g");
    return {
      value: grams,
      unit: "g",
      confidence: 1.0,
      method: "direct",
    };
  } catch {
    // Not a weight unit, try volume conversion
  }

  // Try volume conversion using density
  try {
    const volumeResult = volumeToWeight(amount, unit, ingredientName);
    if (volumeResult.confidence > 0) {
      return volumeResult;
    }
  } catch {
    // Volume conversion failed
  }

  // Unknown unit - return as is with warning and suggestions
  const suggestions = getUnitSuggestions(unit);
  const suggestionText =
    suggestions.length > 0
      ? ` Did you mean: ${suggestions.slice(0, 3).join(", ")}?`
      : "";

  return {
    value: amount,
    unit: unit,
    confidence: 0,
    method: "fallback",
    warning: `Cannot convert unit: ${unit}.${suggestionText}`,
  };
}

/**
 * Get common cooking conversions for display
 */
export function getCommonConversions(
  ingredientName: string
): Record<string, number> | null {
  const density = getIngredientDensity(ingredientName);
  if (!density) return null;

  return {
    "1 cup": density,
    "1 tablespoon": density * 0.0625,
    "1 teaspoon": density * 0.0208333,
    "100g": 100,
  };
}
