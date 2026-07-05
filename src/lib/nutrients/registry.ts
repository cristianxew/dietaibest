/**
 * Nutrient registry — single source of truth for the nutrients the
 * Nutrition Hub tracks, their USDA FDC nutrient numbers, units, and
 * whether more of them is desirable ("goal"), undesirable ("limit"),
 * or context-dependent ("neutral").
 *
 * Pure module: no imports, safe for client and server.
 *
 * @module lib/nutrients/registry
 */

export type NutrientKey =
  | "kcal"
  | "protein"
  | "fat"
  | "carbs"
  | "fiber"
  | "sugar"
  | "satFat"
  | "cholesterol"
  | "sodium"
  | "potassium"
  | "calcium"
  | "iron"
  | "magnesium"
  | "zinc"
  | "vitaminA"
  | "vitaminC"
  | "vitaminD"
  | "vitaminE"
  | "vitaminK"
  | "vitaminB6"
  | "vitaminB12"
  | "folate";

export type NutrientUnit = "kcal" | "g" | "mg" | "ug";

export type NutrientGroup =
  | "energy"
  | "macro"
  | "fatProfile"
  | "mineral"
  | "vitamin";

/** goal = more is better, limit = less is better, neutral = depends on goals */
export type NutrientDirection = "goal" | "limit" | "neutral";

export interface NutrientDef {
  key: NutrientKey;
  /** FDC nutrient numbers; first match wins when extracting */
  usdaNumbers: string[];
  unit: NutrientUnit;
  group: NutrientGroup;
  direction: NutrientDirection;
}

export const NUTRIENT_REGISTRY: Record<NutrientKey, NutrientDef> = {
  kcal: { key: "kcal", usdaNumbers: ["208"], unit: "kcal", group: "energy", direction: "neutral" },
  protein: { key: "protein", usdaNumbers: ["203"], unit: "g", group: "macro", direction: "goal" },
  fat: { key: "fat", usdaNumbers: ["204"], unit: "g", group: "macro", direction: "neutral" },
  carbs: { key: "carbs", usdaNumbers: ["205"], unit: "g", group: "macro", direction: "neutral" },
  fiber: { key: "fiber", usdaNumbers: ["291"], unit: "g", group: "macro", direction: "goal" },
  sugar: { key: "sugar", usdaNumbers: ["269"], unit: "g", group: "macro", direction: "limit" },
  satFat: { key: "satFat", usdaNumbers: ["606"], unit: "g", group: "fatProfile", direction: "limit" },
  cholesterol: { key: "cholesterol", usdaNumbers: ["601"], unit: "mg", group: "fatProfile", direction: "limit" },
  sodium: { key: "sodium", usdaNumbers: ["307"], unit: "mg", group: "mineral", direction: "limit" },
  potassium: { key: "potassium", usdaNumbers: ["306"], unit: "mg", group: "mineral", direction: "goal" },
  calcium: { key: "calcium", usdaNumbers: ["301"], unit: "mg", group: "mineral", direction: "goal" },
  iron: { key: "iron", usdaNumbers: ["303"], unit: "mg", group: "mineral", direction: "goal" },
  magnesium: { key: "magnesium", usdaNumbers: ["304"], unit: "mg", group: "mineral", direction: "goal" },
  zinc: { key: "zinc", usdaNumbers: ["309"], unit: "mg", group: "mineral", direction: "goal" },
  vitaminA: { key: "vitaminA", usdaNumbers: ["320"], unit: "ug", group: "vitamin", direction: "goal" },
  vitaminC: { key: "vitaminC", usdaNumbers: ["401"], unit: "mg", group: "vitamin", direction: "goal" },
  vitaminD: { key: "vitaminD", usdaNumbers: ["328"], unit: "ug", group: "vitamin", direction: "goal" },
  vitaminE: { key: "vitaminE", usdaNumbers: ["323"], unit: "mg", group: "vitamin", direction: "goal" },
  vitaminK: { key: "vitaminK", usdaNumbers: ["430"], unit: "ug", group: "vitamin", direction: "goal" },
  vitaminB6: { key: "vitaminB6", usdaNumbers: ["415"], unit: "mg", group: "vitamin", direction: "goal" },
  vitaminB12: { key: "vitaminB12", usdaNumbers: ["418"], unit: "ug", group: "vitamin", direction: "goal" },
  folate: { key: "folate", usdaNumbers: ["417"], unit: "ug", group: "vitamin", direction: "goal" },
};

/** All registry USDA numbers flattened — passed to the FDC foods endpoint (cap: 25). */
export const EXTENDED_NUTRIENT_NUMBERS: string[] = Object.values(
  NUTRIENT_REGISTRY
).flatMap((def) => def.usdaNumbers);

export const ALL_NUTRIENT_KEYS = Object.keys(
  NUTRIENT_REGISTRY
) as NutrientKey[];
