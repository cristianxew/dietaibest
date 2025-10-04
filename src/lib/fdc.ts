/**
 * USDA FoodData Central (FDC) API Client
 * Server-side only module for querying USDA nutrition data
 *
 * @module lib/fdc
 */

import "server-only";

const API_BASE = "https://api.nal.usda.gov/fdc/v1";
const KEY = process.env.FDC_API_KEY!;

if (!KEY) throw new Error("FDC_API_KEY not set in environment variables.");

/**
 * Core nutrient numbers we track from USDA FDC API
 * 208: Energy (kcal)
 * 203: Protein (g)
 * 204: Total lipid (fat) (g)
 * 205: Carbohydrate, by difference (g)
 * 291: Fiber, total dietary (g)
 */
export const CORE_NUTRIENTS = ["208", "203", "204", "205", "291"] as const;
export type NutrientNumber = (typeof CORE_NUTRIENTS)[number];

/**
 * Macro nutrient type representing the key nutritional values
 */
export type Macro = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
};

/**
 * Priority order for choosing food data types
 * Foundation > Survey (FNDDS) > SR Legacy > Branded
 */
export const DATATYPE_PRIORITY = [
  "Foundation",
  "Survey (FNDDS)",
  "SR Legacy",
  "Branded",
] as const;

export type DataType = (typeof DATATYPE_PRIORITY)[number];

/**
 * FDC Food Nutrient structure
 */
export interface FdcFoodNutrient {
  nutrient?: {
    number?: string;
    name?: string;
    unitName?: string;
  };
  nutrientNumber?: string;
  nutrientName?: string;
  amount: number;
  unitName?: string;
}

/**
 * FDC Food Portion structure (for household measures)
 */
export interface FdcFoodPortion {
  id?: number;
  portionDescription?: string;
  modifier?: string;
  gramWeight: number;
  measureUnit?: {
    name?: string;
    abbreviation?: string;
  };
}

/**
 * FDC Label Nutrients (for branded foods)
 */
export interface FdcLabelNutrients {
  calories?: { value?: number };
  protein?: { value?: number };
  fat?: { value?: number };
  carbohydrates?: { value?: number };
  fiber?: { value?: number };
}

/**
 * Complete FDC Food object
 */
export interface FdcFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  foodNutrients?: FdcFoodNutrient[];
  foodPortions?: FdcFoodPortion[];
  labelNutrients?: FdcLabelNutrients;
  servingSize?: number;
  servingSizeUnit?: string;
}

/**
 * FDC Search result food item (simplified)
 */
export interface FdcSearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
}

/**
 * FDC Search API response
 */
export interface FdcSearchResult {
  foods: FdcSearchFood[];
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
}

/**
 * Search USDA FDC for foods matching a query string
 *
 * @param query - Search term (e.g., "chicken breast", "onion")
 * @param dataTypes - Array of data types to search (defaults to all)
 * @returns Search results with matching foods
 */
export async function fdcSearch(
  query: string,
  dataTypes = ["Foundation", "SR Legacy", "Survey (FNDDS)", "Branded"]
): Promise<FdcSearchResult> {
  const res = await fetch(`${API_BASE}/foods/search?api_key=${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // no-store to avoid Next caching; we do our own DB cache
    cache: "no-store",
    body: JSON.stringify({
      query,
      dataType: dataTypes, // must be an array
      pageSize: 10,
    }),
  });

  if (!res.ok) {
    throw new Error(`FDC search failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as FdcSearchResult;
}

/**
 * Fetch detailed food information for multiple FDC IDs
 * Uses abridged format with only core nutrients for efficiency
 *
 * @param fdcIds - Array of FDC food IDs to fetch
 * @returns Array of food objects with nutritional data
 */
export async function fdcFoodsByIds(fdcIds: number[]): Promise<FdcFood[]> {
  if (!fdcIds.length) return [];

  const url = `${API_BASE}/foods?api_key=${KEY}&format=abridged&nutrients=${CORE_NUTRIENTS.join(
    ","
  )}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ fdcIds }),
  });

  if (!res.ok) {
    throw new Error(`FDC foods fetch failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as FdcFood[];
}

// --- Macros extraction & scaling helpers ---

/**
 * Extract macro nutrients from an FDC food object
 * Works with both abridged and full FDC payload formats
 *
 * @param food - FDC food object
 * @returns Macro nutrients per 100g
 */
export function extractMacrosFromFood(food: FdcFood): Macro {
  const byNum = new Map<string, number>();
  const nutrients = food.foodNutrients ?? [];

  for (const fn of nutrients) {
    const num = fn.nutrient?.number ?? fn.nutrientNumber;
    if (num && typeof fn.amount === "number") {
      byNum.set(String(num), fn.amount);
    }
  }

  return {
    kcal: byNum.get("208") ?? 0,
    protein: byNum.get("203") ?? 0,
    fat: byNum.get("204") ?? 0,
    carbs: byNum.get("205") ?? 0,
    fiber: byNum.get("291") ?? 0,
  };
}

/**
 * Scale per-100g macros to a given gram amount
 *
 * @param mac - Macro nutrients per 100g
 * @param grams - Target gram amount
 * @returns Scaled macro nutrients
 */
export function scalePer100g(mac: Macro, grams: number): Macro {
  const f = grams / 100;
  return {
    kcal: mac.kcal * f,
    protein: mac.protein * f,
    fat: mac.fat * f,
    carbs: mac.carbs * f,
    fiber: mac.fiber * f,
  };
}

/**
 * Try to find a portion matching the unit in foodPortions array
 * Returns gram weight for ONE unit (not multiplied by quantity)
 *
 * @param food - FDC food object with foodPortions
 * @param unit - Unit to match (e.g., "cup", "tbsp")
 * @returns Gram weight per unit, or null if no match found
 */
export function resolveGramWeightFromPortions(
  food: FdcFood,
  unit: string
): number | null {
  const portions = food.foodPortions ?? [];
  const u = unit.toLowerCase();

  const hit = portions.find((p) => {
    const d = `${p.portionDescription ?? ""} ${p.modifier ?? ""}`.toLowerCase();
    return d.includes(u) || d.replace(/s\b/, "") === u; // crude plural handling
  });

  return hit?.gramWeight ?? null;
}

/**
 * Extract branded food serving information
 * For Branded foods: per-serving macros based on labelNutrients & servingSize
 *
 * @param food - FDC food object (typically Branded type)
 * @returns Object with grams per serving and macros per serving (if available)
 */
export function extractBrandedServing(food: FdcFood): {
  gramsPerServing: number | null;
  macrosPerServing: Macro | null;
} {
  const s = food.servingSize;
  const u = (food.servingSizeUnit ?? "").toLowerCase();
  const gramsPerServing =
    typeof s === "number" && (u === "g" || u === "gram" || u === "grams")
      ? s
      : null;

  const ln = food.labelNutrients;
  if (!ln) return { gramsPerServing, macrosPerServing: null };

  const val = (x?: { value?: number }) =>
    typeof x?.value === "number" ? x.value : 0;

  const macros: Macro = {
    kcal: val(ln.calories),
    protein: val(ln.protein),
    fat: val(ln.fat),
    carbs: val(ln.carbohydrates),
    fiber: val(ln.fiber),
  };

  return { gramsPerServing, macrosPerServing: macros };
}
