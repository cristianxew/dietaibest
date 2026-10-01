import { ATWATER_KCAL_PER_GRAM } from "@/lib/nutrition-consistency";

/**
 * Dashboard nutrition math: how a day's planned macros split its calories and
 * how far each value is toward its target.
 *
 * Shares are computed from macro-derived energy (4P + 4C + 9F), never from the
 * stored recipe calories, which can disagree with the macros. Dividing one by
 * the other made the shares add up to more than 100%.
 */

export type MacroKey = "protein" | "carbs" | "fat";

/** Design-system order (design_system.md → "Macro Display Colors"). */
export const MACRO_ORDER: readonly MacroKey[] = ["protein", "carbs", "fat"];

type Grams = Record<MacroKey, number | null | undefined>;

export interface MacroTargets {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface MacroBreakdownEntry {
  key: MacroKey;
  grams: number;
  kcal: number;
  /** Share of macro-derived kcal, a whole percent; the three add up to 100. */
  share: number;
  target: number | null;
  /** Whole percent of the target, uncapped; null without a target. */
  progress: number | null;
}

export interface MacroBreakdown {
  macros: MacroBreakdownEntry[];
  /** Energy implied by the macros. */
  macroKcal: number;
  /** Stored calories, or the macro-derived kcal when no calories are stored. */
  totalKcal: number;
  /** Whole percent of the calorie target, uncapped; null without a target. */
  calorieProgress: number | null;
}

const clean = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;

/** Energy of each macro in kcal; null, negative and non-finite grams count as 0. */
export function macroKcal(grams: Grams): Record<MacroKey, number> {
  return {
    protein: clean(grams.protein) * ATWATER_KCAL_PER_GRAM.protein,
    carbs: clean(grams.carbs) * ATWATER_KCAL_PER_GRAM.carbs,
    fat: clean(grams.fat) * ATWATER_KCAL_PER_GRAM.fat,
  };
}

/**
 * Each macro's share of macro-derived kcal as whole percents that add up to
 * exactly 100 (largest-remainder rounding; ties go to the earlier macro in
 * `MACRO_ORDER`). All zero when there are no macros.
 */
export function calorieShares(grams: Grams): Record<MacroKey, number> {
  const kcal = macroKcal(grams);
  const total = kcal.protein + kcal.carbs + kcal.fat;
  const shares: Record<MacroKey, number> = { protein: 0, carbs: 0, fat: 0 };
  if (total <= 0) return shares;

  const raw = MACRO_ORDER.map((key) => ({ key, value: (kcal[key] / total) * 100 }));
  for (const { key, value } of raw) shares[key] = Math.floor(value);

  let leftover = 100 - MACRO_ORDER.reduce((sum, key) => sum + shares[key], 0);
  const byRemainder = [...raw].sort(
    (a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value))
  );
  for (const { key } of byRemainder) {
    if (leftover <= 0) break;
    shares[key] += 1;
    leftover -= 1;
  }
  return shares;
}

/** Whole percent of `target` reached by `current`, uncapped; null without a target. */
export function progressPercent(
  current: number | null | undefined,
  target: number | null | undefined
): number | null {
  if (typeof target !== "number" || !(target > 0)) return null;
  return Math.round((clean(current) / target) * 100);
}

export function getMacroBreakdown(
  day: { calories: number | null | undefined } & Grams,
  targets: MacroTargets
): MacroBreakdown {
  const kcal = macroKcal(day);
  const shares = calorieShares(day);
  const totalMacroKcal = kcal.protein + kcal.carbs + kcal.fat;
  const totalKcal = clean(day.calories) || totalMacroKcal;

  return {
    macros: MACRO_ORDER.map((key) => ({
      key,
      grams: clean(day[key]),
      kcal: kcal[key],
      share: shares[key],
      target: targets[key],
      progress: progressPercent(day[key], targets[key]),
    })),
    macroKcal: totalMacroKcal,
    totalKcal,
    calorieProgress: progressPercent(totalKcal, targets.calories),
  };
}

interface PlanTargets {
  targetCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFat?: number | null;
}

interface ProfileTargets {
  dailyCalories?: number | null;
  proteinGrams?: number | null;
  carbsGrams?: number | null;
  fatGrams?: number | null;
}

/**
 * The day's targets: the active plan's, falling back per macro to the
 * profile's. A 0 counts as "not set". Resolve once and pass the result to every
 * dashboard card, so they all measure against the same numbers.
 */
export function resolveMacroTargets(
  plan: PlanTargets | null | undefined,
  profile: ProfileTargets | null | undefined
): MacroTargets {
  return {
    calories: plan?.targetCalories || profile?.dailyCalories || null,
    protein: plan?.targetProtein || profile?.proteinGrams || null,
    carbs: plan?.targetCarbs || profile?.carbsGrams || null,
    fat: plan?.targetFat || profile?.fatGrams || null,
  };
}
