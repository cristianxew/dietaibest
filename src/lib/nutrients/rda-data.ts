/**
 * Dietary reference data for personalized daily targets.
 *
 * Sources: NIH Office of Dietary Supplements DRI tables (RDA/AI per sex ×
 * age bracket, 2019 NASEM potassium/sodium update) and FDA Daily Values
 * for adults on a 2,000-kcal diet (fallback + limit nutrients).
 * Values are daily amounts in the registry unit for each nutrient.
 *
 * @module lib/nutrients/rda-data
 */

import type { NutrientKey } from "@/lib/nutrients/registry";

export type Sex = "male" | "female";

export interface DriBracket {
  sex: Sex;
  /** Inclusive age range in years */
  ageMin: number;
  ageMax: number;
  values: Partial<Record<NutrientKey, number>>;
}

export const DRI_BRACKETS: DriBracket[] = [
  // ── male ────────────────────────────────────────────────────────────
  {
    sex: "male",
    ageMin: 14,
    ageMax: 18,
    values: {
      protein: 52, fiber: 38, potassium: 3000, calcium: 1300, iron: 11,
      magnesium: 410, zinc: 11, vitaminA: 900, vitaminC: 75, vitaminD: 15,
      vitaminE: 15, vitaminK: 75, vitaminB6: 1.3, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "male",
    ageMin: 19,
    ageMax: 30,
    values: {
      protein: 56, fiber: 38, potassium: 3400, calcium: 1000, iron: 8,
      magnesium: 400, zinc: 11, vitaminA: 900, vitaminC: 90, vitaminD: 15,
      vitaminE: 15, vitaminK: 120, vitaminB6: 1.3, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "male",
    ageMin: 31,
    ageMax: 50,
    values: {
      protein: 56, fiber: 38, potassium: 3400, calcium: 1000, iron: 8,
      magnesium: 420, zinc: 11, vitaminA: 900, vitaminC: 90, vitaminD: 15,
      vitaminE: 15, vitaminK: 120, vitaminB6: 1.3, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "male",
    ageMin: 51,
    ageMax: 70,
    values: {
      protein: 56, fiber: 30, potassium: 3400, calcium: 1000, iron: 8,
      magnesium: 420, zinc: 11, vitaminA: 900, vitaminC: 90, vitaminD: 15,
      vitaminE: 15, vitaminK: 120, vitaminB6: 1.7, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "male",
    ageMin: 71,
    ageMax: 130,
    values: {
      protein: 56, fiber: 30, potassium: 3400, calcium: 1200, iron: 8,
      magnesium: 420, zinc: 11, vitaminA: 900, vitaminC: 90, vitaminD: 20,
      vitaminE: 15, vitaminK: 120, vitaminB6: 1.7, vitaminB12: 2.4, folate: 400,
    },
  },
  // ── female ──────────────────────────────────────────────────────────
  {
    sex: "female",
    ageMin: 14,
    ageMax: 18,
    values: {
      protein: 46, fiber: 26, potassium: 2300, calcium: 1300, iron: 15,
      magnesium: 360, zinc: 9, vitaminA: 700, vitaminC: 65, vitaminD: 15,
      vitaminE: 15, vitaminK: 75, vitaminB6: 1.2, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "female",
    ageMin: 19,
    ageMax: 30,
    values: {
      protein: 46, fiber: 25, potassium: 2600, calcium: 1000, iron: 18,
      magnesium: 310, zinc: 8, vitaminA: 700, vitaminC: 75, vitaminD: 15,
      vitaminE: 15, vitaminK: 90, vitaminB6: 1.3, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "female",
    ageMin: 31,
    ageMax: 50,
    values: {
      protein: 46, fiber: 25, potassium: 2600, calcium: 1000, iron: 18,
      magnesium: 320, zinc: 8, vitaminA: 700, vitaminC: 75, vitaminD: 15,
      vitaminE: 15, vitaminK: 90, vitaminB6: 1.3, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "female",
    ageMin: 51,
    ageMax: 70,
    values: {
      protein: 46, fiber: 21, potassium: 2600, calcium: 1200, iron: 8,
      magnesium: 320, zinc: 8, vitaminA: 700, vitaminC: 75, vitaminD: 15,
      vitaminE: 15, vitaminK: 90, vitaminB6: 1.5, vitaminB12: 2.4, folate: 400,
    },
  },
  {
    sex: "female",
    ageMin: 71,
    ageMax: 130,
    values: {
      protein: 46, fiber: 21, potassium: 2600, calcium: 1200, iron: 8,
      magnesium: 320, zinc: 8, vitaminA: 700, vitaminC: 75, vitaminD: 20,
      vitaminE: 15, vitaminK: 90, vitaminB6: 1.5, vitaminB12: 2.4, folate: 400,
    },
  },
];

/** FDA Daily Values, adults, 2,000-kcal reference diet. */
export const FDA_DAILY_VALUES: Record<NutrientKey, number> = {
  kcal: 2000,
  protein: 50,
  fat: 78,
  carbs: 275,
  fiber: 28,
  sugar: 50, // added-sugars DV used as a total-sugar proxy (footnoted in UI)
  satFat: 20,
  cholesterol: 300,
  sodium: 2300, // CDRR
  potassium: 4700,
  calcium: 1300,
  iron: 18,
  magnesium: 420,
  zinc: 11,
  vitaminA: 900,
  vitaminC: 90,
  vitaminD: 20,
  vitaminE: 15,
  vitaminK: 120,
  vitaminB6: 1.7,
  vitaminB12: 2.4,
  folate: 400,
};

/** Limit nutrients use the same daily ceiling for everyone. */
export const LIMIT_VALUES: Partial<Record<NutrientKey, number>> = {
  sugar: 50,
  satFat: 20,
  cholesterol: 300,
  sodium: 2300,
};

export function findDriBracket(sex: Sex, age: number): DriBracket | null {
  return (
    DRI_BRACKETS.find(
      (bracket) =>
        bracket.sex === sex && age >= bracket.ageMin && age <= bracket.ageMax
    ) ?? null
  );
}
