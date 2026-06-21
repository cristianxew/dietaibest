/**
 * Hand-built FDC fixture store for the ANCHOR-tier golden recipes.
 *
 * Per-100g values are realistic USDA figures for these staple ids; the recipes'
 * expected per-serving macros in `recipes.ts` are computed by hand from exactly
 * these numbers, so the anchor tier is a true closed-form check of the pipeline
 * math (parse → staple match → gram resolve → scale → aggregate → ÷ servings).
 *
 * The live recorder (`record-fixtures.ts`) emits the same shape from real USDA
 * responses for the real-world tier.
 *
 * @module tests/eval/nutrition/fixtures/anchor-foods
 */

import { type FdcFood, type FdcSearchFood } from "@/lib/fdc";
import { normalizeKey, type FdcFixtureStore } from "../lib/replay";

interface Per100g {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

function food(fdcId: number, description: string, m: Per100g): FdcFood {
  return {
    fdcId,
    description,
    dataType: "SR Legacy",
    foodNutrients: [
      { nutrientNumber: "208", amount: m.calories, unitName: "KCAL" },
      { nutrientNumber: "203", amount: m.protein, unitName: "G" },
      { nutrientNumber: "204", amount: m.fat, unitName: "G" },
      { nutrientNumber: "205", amount: m.carbs, unitName: "G" },
      { nutrientNumber: "291", amount: m.fiber, unitName: "G" },
    ],
  };
}

const EGG = food(171287, "Egg, whole, raw, fresh", {
  calories: 143,
  protein: 12.56,
  fat: 9.51,
  carbs: 0.72,
  fiber: 0,
});
const SPINACH = food(168462, "Spinach, raw", {
  calories: 23,
  protein: 2.86,
  fat: 0.39,
  carbs: 3.63,
  fiber: 2.2,
});
const OLIVE_OIL = food(171413, "Oil, olive, salad or cooking", {
  calories: 884,
  protein: 0,
  fat: 100,
  carbs: 0,
  fiber: 0,
});
const BANANA = food(173944, "Bananas, raw", {
  calories: 89,
  protein: 1.09,
  fat: 0.33,
  carbs: 22.84,
  fiber: 2.6,
});
const CHICKEN = food(171077, "Chicken, breast, boneless, skinless, raw", {
  calories: 120,
  protein: 22.5,
  fat: 2.62,
  carbs: 0,
  fiber: 0,
});
const SALMON = food(173686, "Fish, salmon, Atlantic, wild, raw", {
  calories: 142,
  protein: 19.84,
  fat: 6.34,
  carbs: 0,
  fiber: 0,
});

const ALL_FOODS = [EGG, SPINACH, OLIVE_OIL, BANANA, CHICKEN, SALMON];

function hit(f: FdcFood): FdcSearchFood {
  return { fdcId: f.fdcId, description: f.description, dataType: f.dataType };
}

/** Search results keyed by the parsed ingredient name each recipe produces. */
const SEARCH: Record<string, FdcSearchFood[]> = {
  egg: [hit(EGG)],
  spinach: [hit(SPINACH)],
  "olive oil": [hit(OLIVE_OIL)],
  banana: [hit(BANANA)],
  "chicken breast": [hit(CHICKEN)],
  salmon: [hit(SALMON)],
};

export const anchorStore: FdcFixtureStore = {
  search: Object.fromEntries(
    Object.entries(SEARCH).map(([k, v]) => [normalizeKey(k), v])
  ),
  foods: Object.fromEntries(ALL_FOODS.map((f) => [f.fdcId, f])),
};
