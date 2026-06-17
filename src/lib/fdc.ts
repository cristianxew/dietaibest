/**
 * USDA FoodData Central (FDC) API Client
 * Server-side only module for querying USDA nutrition data
 *
 * @module lib/fdc
 */

import "server-only";

const API_BASE = "https://api.nal.usda.gov/fdc/v1";

/**
 * Get API key at runtime (not build time)
 */
function getApiKey(): string {
  const key = process.env.FDC_API_KEY;
  if (!key) {
    throw new Error("FDC_API_KEY not set in environment variables.");
  }
  return key;
}

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
 * Full nutrient profile (5 macros + 17 micronutrients) keyed by the column
 * names on the Prisma `Recipe` model, so persistence is a direct spread.
 */
export type Profile = {
  // Macros
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  // Micronutrients
  sugar: number;
  sodium: number;
  cholesterol: number;
  saturatedFat: number;
  transFat: number;
  vitaminA: number;
  vitaminC: number;
  vitaminD: number;
  vitaminE: number;
  vitaminK: number;
  vitaminB12: number;
  folate: number;
  iron: number;
  calcium: number;
  magnesium: number;
  potassium: number;
  zinc: number;
};

/**
 * Maps each `Profile` field to its canonical USDA FDC nutrient number.
 *
 * ⚠️ Mineral numbers are easy to get wrong — the canonical values are
 * calcium=301, iron=303, magnesium=304, potassium=306 (305 is Phosphorus).
 * Vitamins use the µg/mg-native numbers, NOT the IU variants:
 * vitaminA=320 (RAE, not 318 IU), vitaminD=328 (µg, not 324 IU),
 * folate=417 (total µg, not 435 DFE).
 */
export const PROFILE_NUTRIENT_MAP: Record<keyof Profile, string> = {
  calories: "208",
  protein: "203",
  fat: "204",
  carbs: "205",
  fiber: "291",
  sugar: "269",
  sodium: "307",
  cholesterol: "601",
  saturatedFat: "606",
  transFat: "605",
  vitaminA: "320",
  vitaminC: "401",
  vitaminD: "328",
  vitaminE: "323",
  vitaminK: "430",
  vitaminB12: "418",
  folate: "417",
  iron: "303",
  calcium: "301",
  magnesium: "304",
  potassium: "306",
  zinc: "309",
};

/**
 * Expected unit per `Profile` field — matches the units declared in
 * `nutrition-fields.ts`. Used to reject wrong-magnitude values (e.g. an IU
 * reading where we expect µg) instead of silently persisting them.
 */
export const PROFILE_EXPECTED_UNITS: Record<keyof Profile, string> = {
  calories: "kcal",
  protein: "g",
  fat: "g",
  carbs: "g",
  fiber: "g",
  sugar: "g",
  sodium: "mg",
  cholesterol: "mg",
  saturatedFat: "g",
  transFat: "g",
  vitaminA: "µg",
  vitaminC: "mg",
  vitaminD: "µg",
  vitaminE: "mg",
  vitaminK: "µg",
  vitaminB12: "µg",
  folate: "µg",
  iron: "mg",
  calcium: "mg",
  magnesium: "mg",
  potassium: "mg",
  zinc: "mg",
};

/** All FDC nutrient numbers we request and extract (the 22 profile fields). */
export const PROFILE_NUTRIENT_NUMBERS: string[] = Object.values(
  PROFILE_NUTRIENT_MAP
);

/**
 * The 17 micronutrient numbers (profile minus the 5 core macros). A cached
 * food carrying at least one of these was fetched under the full-profile
 * schema — used to detect and refresh legacy core-only cache rows.
 */
export const MICRO_NUTRIENT_NUMBERS: string[] = PROFILE_NUTRIENT_NUMBERS.filter(
  (n) => !(CORE_NUTRIENTS as readonly string[]).includes(n)
);

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
  const res = await fetch(`${API_BASE}/foods/search?api_key=${getApiKey()}`, {
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
 * Fetch detailed food information for multiple FDC IDs.
 * Uses abridged format requesting the full 22-nutrient profile (5 macros + 17
 * micronutrients) so the complete profile can be extracted and persisted.
 *
 * @param fdcIds - Array of FDC food IDs to fetch
 * @returns Array of food objects with nutritional data
 */
export async function fdcFoodsByIds(fdcIds: number[]): Promise<FdcFood[]> {
  if (!fdcIds.length) return [];

  const url = `${API_BASE}/foods?api_key=${getApiKey()}&format=abridged&nutrients=${PROFILE_NUTRIENT_NUMBERS.join(
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

  // The endpoint normally returns a JSON array, but USDA has been observed
  // replying `200` with a non-array body (e.g. `{}`) under rate-limit/error.
  // The old `as FdcFood[]` cast lied to the compiler and let `{}` reach a
  // `for...of` downstream, throwing "not iterable" and silently dropping the
  // whole batch. Always hand callers a real array.
  const data = await res.json();
  if (!Array.isArray(data)) {
    console.warn(
      `[fdc] foods endpoint returned a non-array response (${typeof data}) for ${fdcIds.length} id(s); treating as empty`
    );
    return [];
  }

  return data as FdcFood[];
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

// --- Full profile extraction, scaling & aggregation helpers ---

/** Canonicalize an FDC unit string for comparison (µg/ug/mcg → "ug"). */
function canonUnit(u: string): string {
  const x = u.toLowerCase().trim();
  if (x === "µg" || x === "ug" || x === "mcg") return "ug";
  return x;
}

/**
 * Extract the full 22-nutrient profile from an FDC food object (per 100g).
 *
 * A field is left at 0 when the nutrient is absent OR reported in an
 * unexpected unit (e.g. an IU value where we expect µg) — we never persist a
 * wrong-magnitude number.
 */
export function extractProfileFromFood(food: FdcFood): Profile {
  const byNum = new Map<string, { amount: number; unit: string }>();
  for (const fn of food.foodNutrients ?? []) {
    const num = fn.nutrient?.number ?? fn.nutrientNumber;
    const unit = fn.unitName ?? fn.nutrient?.unitName ?? "";
    if (num && typeof fn.amount === "number") {
      byNum.set(String(num), { amount: fn.amount, unit });
    }
  }

  const out = {} as Profile;
  for (const key of Object.keys(PROFILE_NUTRIENT_MAP) as (keyof Profile)[]) {
    const hit = byNum.get(PROFILE_NUTRIENT_MAP[key]);
    if (!hit) {
      out[key] = 0;
      continue;
    }
    if (canonUnit(hit.unit) !== canonUnit(PROFILE_EXPECTED_UNITS[key])) {
      console.warn(
        `[fdc] ${key} (#${PROFILE_NUTRIENT_MAP[key]}) unexpected unit "${hit.unit}", expected "${PROFILE_EXPECTED_UNITS[key]}" — skipping`
      );
      out[key] = 0;
      continue;
    }
    out[key] = hit.amount;
  }
  return out;
}

/** A profile with every field at 0 — additive identity for aggregation. */
export function zeroProfile(): Profile {
  const out = {} as Profile;
  for (const key of Object.keys(PROFILE_NUTRIENT_MAP) as (keyof Profile)[]) {
    out[key] = 0;
  }
  return out;
}

/** Scale a per-100g profile to a given gram amount. */
export function scaleProfilePer100g(p: Profile, grams: number): Profile {
  const f = grams / 100;
  const out = {} as Profile;
  for (const key of Object.keys(PROFILE_NUTRIENT_MAP) as (keyof Profile)[]) {
    out[key] = p[key] * f;
  }
  return out;
}

/** Field-wise sum of two profiles. */
export function addProfile(a: Profile, b: Profile): Profile {
  const out = {} as Profile;
  for (const key of Object.keys(PROFILE_NUTRIENT_MAP) as (keyof Profile)[]) {
    out[key] = a[key] + b[key];
  }
  return out;
}

/** Field-wise division of a profile by a divisor (e.g. servings). */
export function divideProfile(p: Profile, divisor: number): Profile {
  const d = divisor || 1;
  const out = {} as Profile;
  for (const key of Object.keys(PROFILE_NUTRIENT_MAP) as (keyof Profile)[]) {
    out[key] = p[key] / d;
  }
  return out;
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
