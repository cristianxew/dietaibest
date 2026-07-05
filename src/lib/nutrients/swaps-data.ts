/**
 * Smart Swaps — curated "trade this for that" pairs. The nutritional win
 * is NEVER hand-written: deltas are computed live from USDA data by the
 * insights engine, restricted to each pair's headline nutrients.
 *
 * Only verified SR Legacy fdcIds (resolved live; see encyclopedia.ts for
 * the shared pool).
 *
 * @module lib/nutrients/swaps-data
 */

import type { NutrientKey } from "@/lib/nutrients/registry";

export const SWAP_CATEGORIES = [
  "grains",
  "greens",
  "protein",
  "fruit",
  "fats",
] as const;

export type SwapCategory = (typeof SWAP_CATEGORIES)[number];

export interface SmartSwap {
  id: string;
  fromFdcId: number;
  toFdcId: number;
  headlineNutrients: NutrientKey[];
  category: SwapCategory;
}

export const SMART_SWAPS: SmartSwap[] = [
  {
    id: "white-rice-to-lentils",
    fromFdcId: 168878, // rice, white, long-grain, regular, enriched, cooked
    toFdcId: 172421, // lentils, cooked
    headlineNutrients: ["protein", "fiber", "iron"],
    category: "grains",
  },
  {
    id: "white-rice-to-brown-rice",
    fromFdcId: 168878,
    toFdcId: 2708414, // rice, brown, cooked, no added fat (FNDDS)
    headlineNutrients: ["fiber", "magnesium"],
    category: "grains",
  },
  {
    id: "iceberg-to-spinach",
    fromFdcId: 2346388, // lettuce, iceberg, raw (Foundation)
    toFdcId: 168462, // spinach, raw
    headlineNutrients: ["iron", "folate", "vitaminK"],
    category: "greens",
  },
  {
    id: "chicken-to-salmon",
    fromFdcId: 171477, // chicken breast, raw
    toFdcId: 175167, // salmon, Atlantic, farmed, raw
    headlineNutrients: ["vitaminD", "vitaminB12"],
    category: "protein",
  },
  {
    id: "apple-to-banana",
    fromFdcId: 171688, // apple, raw, with skin
    toFdcId: 173944, // banana, raw
    headlineNutrients: ["potassium", "vitaminB6"],
    category: "fruit",
  },
  {
    id: "apple-to-orange",
    fromFdcId: 171688,
    toFdcId: 169097, // orange, raw
    headlineNutrients: ["vitaminC", "folate"],
    category: "fruit",
  },
  {
    id: "butter-to-avocado",
    fromFdcId: 173410, // butter, salted
    toFdcId: 171705, // avocado, raw
    headlineNutrients: ["satFat", "fiber", "potassium"],
    category: "fats",
  },
];
