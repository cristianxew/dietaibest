/**
 * Personalized daily-target computation.
 *
 * Precedence per nutrient:
 *   1. user onboarding targets (kcal, protein, carbs, fat)
 *   2. NIH DRI bracket by sex + age
 *   3. derived values (fiber = 14 g per 1,000 kcal of the calorie target)
 *   4. FDA Daily Values (generic fallback — never crash, never guess sex)
 * Limit nutrients (sugar, satFat, cholesterol, sodium) are fixed ceilings.
 *
 * Pure module — profile loading lives in the server action.
 *
 * @module lib/nutrients/rda
 */

import {
  ALL_NUTRIENT_KEYS,
  NUTRIENT_REGISTRY,
  type NutrientDirection,
  type NutrientKey,
  type NutrientUnit,
} from "@/lib/nutrients/registry";
import {
  FDA_DAILY_VALUES,
  LIMIT_VALUES,
  findDriBracket,
  type Sex,
} from "@/lib/nutrients/rda-data";

export interface RdaInput {
  dateOfBirth?: Date | null;
  gender?: string | null;
  weightKg?: number | null;
  dailyCalories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
}

export type RdaBasis = "userTarget" | "dri" | "derived" | "fdaDv";

export interface RdaEntry {
  nutrient: NutrientKey;
  value: number;
  unit: NutrientUnit;
  basis: RdaBasis;
  direction: NutrientDirection;
}

export interface RdaProfile {
  entries: Record<NutrientKey, RdaEntry>;
  /** True when DRI brackets or user targets informed the numbers */
  personalized: boolean;
}

function normalizeSex(gender: string | null | undefined): Sex | null {
  const g = gender?.trim().toLowerCase();
  if (g === "male" || g === "m") return "male";
  if (g === "female" || g === "f") return "female";
  return null;
}

function ageAt(dateOfBirth: Date, asOf: Date): number {
  let age = asOf.getFullYear() - dateOfBirth.getFullYear();
  const beforeBirthday =
    asOf.getMonth() < dateOfBirth.getMonth() ||
    (asOf.getMonth() === dateOfBirth.getMonth() &&
      asOf.getDate() < dateOfBirth.getDate());
  if (beforeBirthday) age--;
  return age;
}

export function computeRdaProfile(
  input: RdaInput,
  asOf: Date = new Date()
): RdaProfile {
  const sex = normalizeSex(input.gender);
  const age = input.dateOfBirth ? ageAt(input.dateOfBirth, asOf) : null;
  const bracket =
    sex && age !== null && age >= 14 ? findDriBracket(sex, age) : null;

  const userTargets: Partial<Record<NutrientKey, number>> = {
    ...(input.dailyCalories ? { kcal: input.dailyCalories } : {}),
    ...(input.proteinGrams ? { protein: input.proteinGrams } : {}),
    ...(input.carbsGrams ? { carbs: input.carbsGrams } : {}),
    ...(input.fatGrams ? { fat: input.fatGrams } : {}),
  };

  const entries = {} as Record<NutrientKey, RdaEntry>;
  let usedDri = false;

  for (const nutrient of ALL_NUTRIENT_KEYS) {
    const def = NUTRIENT_REGISTRY[nutrient];

    let value: number | undefined;
    let basis: RdaBasis;

    const limitValue = LIMIT_VALUES[nutrient];
    const userTarget = userTargets[nutrient];
    const driValue = bracket?.values[nutrient];

    if (limitValue !== undefined) {
      value = limitValue;
      basis = "fdaDv";
    } else if (userTarget !== undefined) {
      value = userTarget;
      basis = "userTarget";
    } else if (driValue !== undefined) {
      value = driValue;
      basis = "dri";
      usedDri = true;
    } else if (nutrient === "fiber" && input.dailyCalories) {
      value = Math.round((input.dailyCalories / 1000) * 14);
      basis = "derived";
    } else {
      value = FDA_DAILY_VALUES[nutrient];
      basis = "fdaDv";
    }

    entries[nutrient] = {
      nutrient,
      value,
      unit: def.unit,
      basis,
      direction: def.direction,
    };
  }

  return {
    entries,
    personalized: usedDri || Object.keys(userTargets).length > 0,
  };
}
