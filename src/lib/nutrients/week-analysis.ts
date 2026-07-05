/**
 * Week-level nutrition analysis: planned meals vs personal daily targets.
 *
 * Emits structured, ranked Findings with per-meal attribution — the UI
 * builds sentences from ICU messages, this module only does math.
 * Sparse-vector rule applies throughout: a missing key is unknown, never
 * zero, and unknowns never count toward gaps or attributions.
 *
 * Pure module.
 *
 * @module lib/nutrients/week-analysis
 */

import {
  addVectors,
  scaleVector,
  type NutrientVector,
} from "@/lib/nutrients/extract";
import { ALL_NUTRIENT_KEYS, type NutrientKey } from "@/lib/nutrients/registry";
import type { NutrientCoverage } from "@/lib/nutrients/aggregate";
import type { RdaProfile } from "@/lib/nutrients/rda";

export interface PlannedMealInput {
  mealId: string;
  recipeId: string;
  recipeTitle: string;
  mealType: string;
  /** MealPlanMeal.servings — how many recipe servings this meal represents */
  servings: number;
  perServing: NutrientVector;
  coverage: NutrientCoverage;
}

export interface WindowDayInput {
  /** YYYY-MM-DD */
  date: string;
  planned: boolean;
  meals: PlannedMealInput[];
}

export interface DayAnalysis {
  date: string;
  planned: boolean;
  totals: NutrientVector;
  /** total / daily target; 1 = exactly met. Absent when nutrient unknown. */
  fill: Partial<Record<NutrientKey, number>>;
  coverage: NutrientCoverage;
  meals: PlannedMealInput[];
}

export interface MealContribution {
  mealId: string;
  recipeId: string;
  recipeTitle: string;
  date: string;
  mealType: string;
  /** This meal's week amount of the finding nutrient */
  amount: number;
  /** Fraction of the week total of that nutrient */
  share: number;
}

export type FindingKind = "deficit" | "excess";

export interface Finding {
  id: string;
  kind: FindingKind;
  nutrient: NutrientKey;
  daysAffected: number;
  plannedDays: number;
  weekGapAmount: number;
  severity: number;
  topContributors: MealContribution[];
}

export interface WeekCoverage {
  fullMeals: number;
  partialMeals: number;
  macrosOnlyMeals: number;
  totalMeals: number;
  unplannedDays: number;
}

export interface WeekAnalysis {
  generatedAt: string;
  days: DayAnalysis[];
  weekTotals: NutrientVector;
  avgPerPlannedDay: NutrientVector;
  findings: Finding[];
  microFindingsReliable: boolean;
  coverage: WeekCoverage;
  personalized: boolean;
}

const DEFICIT_FILL_FLOOR = 0.7;
const KCAL_EXCESS_CEILING = 1.15;
const MIN_EXCESS_DAYS = 2;
const LIMIT_SEVERITY_WEIGHT = 1.25;
const MAX_CONTRIBUTORS = 3;
const MACROS_ONLY_RELIABILITY_CUTOFF = 0.5;

/** Findings allowed when micro coverage is unreliable (stored Recipe macros). */
const MACRO_FINDING_KEYS: ReadonlySet<NutrientKey> = new Set([
  "kcal",
  "protein",
  "fiber",
]);
/** Neutral macros never produce findings — kcal + satFat cover their story. */
const NO_FINDING_KEYS: ReadonlySet<NutrientKey> = new Set(["carbs", "fat"]);

const COVERAGE_RANK: Record<NutrientCoverage, number> = {
  full: 0,
  partial: 1,
  macrosOnly: 2,
};

function worstCoverage(meals: PlannedMealInput[]): NutrientCoverage {
  let worst: NutrientCoverage = "full";
  for (const m of meals) {
    if (COVERAGE_RANK[m.coverage] > COVERAGE_RANK[worst]) worst = m.coverage;
  }
  return worst;
}

interface WeekMeal extends PlannedMealInput {
  date: string;
  weekVector: NutrientVector;
}

function contribution(
  meal: WeekMeal,
  nutrient: NutrientKey,
  weekTotal: number
): MealContribution {
  const amount = meal.weekVector[nutrient] ?? 0;
  return {
    mealId: meal.mealId,
    recipeId: meal.recipeId,
    recipeTitle: meal.recipeTitle,
    date: meal.date,
    mealType: meal.mealType,
    amount,
    share: weekTotal > 0 ? amount / weekTotal : 0,
  };
}

export function analyzeWeek(
  days: WindowDayInput[],
  rda: RdaProfile,
  now: Date = new Date()
): WeekAnalysis {
  const dayAnalyses: DayAnalysis[] = [];
  const allMeals: WeekMeal[] = [];

  for (const d of days) {
    const weekMeals: WeekMeal[] = d.meals.map((m) => ({
      ...m,
      date: d.date,
      weekVector: scaleVector(m.perServing, m.servings),
    }));
    allMeals.push(...weekMeals);

    const totals = weekMeals.reduce<NutrientVector>(
      (sum, m) => addVectors(sum, m.weekVector),
      {}
    );

    const fill: Partial<Record<NutrientKey, number>> = {};
    for (const key of Object.keys(totals) as NutrientKey[]) {
      const target = rda.entries[key]?.value;
      if (target && target > 0) fill[key] = (totals[key] as number) / target;
    }

    dayAnalyses.push({
      date: d.date,
      planned: d.planned,
      totals,
      fill,
      coverage: d.meals.length > 0 ? worstCoverage(d.meals) : "full",
      meals: d.meals,
    });
  }

  const plannedDayAnalyses = dayAnalyses.filter((d) => d.planned);
  const plannedDays = plannedDayAnalyses.length;
  const weekTotals = plannedDayAnalyses.reduce<NutrientVector>(
    (sum, d) => addVectors(sum, d.totals),
    {}
  );

  const coverage: WeekCoverage = {
    fullMeals: allMeals.filter((m) => m.coverage === "full").length,
    partialMeals: allMeals.filter((m) => m.coverage === "partial").length,
    macrosOnlyMeals: allMeals.filter((m) => m.coverage === "macrosOnly").length,
    totalMeals: allMeals.length,
    unplannedDays: days.filter((d) => !d.planned).length,
  };
  const microFindingsReliable =
    coverage.totalMeals === 0 ||
    coverage.macrosOnlyMeals / coverage.totalMeals <=
      MACROS_ONLY_RELIABILITY_CUTOFF;

  const findings: Finding[] = [];

  for (const nutrient of ALL_NUTRIENT_KEYS) {
    if (NO_FINDING_KEYS.has(nutrient)) continue;
    if (!microFindingsReliable && !MACRO_FINDING_KEYS.has(nutrient)) continue;

    const entry = rda.entries[nutrient];
    if (!entry || entry.value <= 0) continue;
    const target = entry.value;

    const knownDays = plannedDayAnalyses.filter(
      (d) => d.totals[nutrient] !== undefined
    );
    if (knownDays.length === 0) continue;

    const totalsOf = (d: DayAnalysis) => d.totals[nutrient] as number;
    const weekTotal = weekTotals[nutrient] ?? 0;
    const knownMeals = allMeals.filter(
      (m) => m.weekVector[nutrient] !== undefined
    );

    // Deficit: goal nutrients, plus kcal (neutral but headline-worthy)
    if (entry.direction === "goal" || nutrient === "kcal") {
      const misses = knownDays.filter(
        (d) => totalsOf(d) < DEFICIT_FILL_FLOOR * target
      );
      if (misses.length >= Math.ceil(knownDays.length / 2)) {
        const gap = knownDays.reduce(
          (s, d) => s + Math.max(0, target - totalsOf(d)),
          0
        );
        if (gap > 0) {
          findings.push({
            id: `deficit:${nutrient}`,
            kind: "deficit",
            nutrient,
            daysAffected: misses.length,
            plannedDays,
            weekGapAmount: gap,
            severity:
              (gap / (target * knownDays.length)) *
              (misses.length / knownDays.length),
            topContributors: [...knownMeals]
              .sort(
                (a, b) =>
                  (a.weekVector[nutrient] ?? 0) - (b.weekVector[nutrient] ?? 0)
              )
              .slice(0, MAX_CONTRIBUTORS)
              .map((m) => contribution(m, nutrient, weekTotal)),
          });
        }
      }
    }

    // Excess: limit nutrients at their ceiling, kcal at 1.15× target
    const isLimit = entry.direction === "limit";
    if (isLimit || nutrient === "kcal") {
      const ceiling = isLimit ? target : KCAL_EXCESS_CEILING * target;
      const overs = knownDays.filter((d) => totalsOf(d) > ceiling);
      if (overs.length >= MIN_EXCESS_DAYS) {
        const gap = knownDays.reduce(
          (s, d) => s + Math.max(0, totalsOf(d) - ceiling),
          0
        );
        findings.push({
          id: `excess:${nutrient}`,
          kind: "excess",
          nutrient,
          daysAffected: overs.length,
          plannedDays,
          weekGapAmount: gap,
          severity:
            (gap / (ceiling * knownDays.length)) *
            (overs.length / knownDays.length) *
            (isLimit ? LIMIT_SEVERITY_WEIGHT : 1),
          topContributors: [...knownMeals]
            .sort(
              (a, b) =>
                (b.weekVector[nutrient] ?? 0) - (a.weekVector[nutrient] ?? 0)
            )
            .slice(0, MAX_CONTRIBUTORS)
            .map((m) => contribution(m, nutrient, weekTotal)),
        });
      }
    }
  }

  findings.sort((a, b) => b.severity - a.severity);

  return {
    generatedAt: now.toISOString(),
    days: dayAnalyses,
    weekTotals,
    avgPerPlannedDay:
      plannedDays > 0 ? scaleVector(weekTotals, 1 / plannedDays) : {},
    findings,
    microFindingsReliable,
    coverage,
    personalized: rda.personalized,
  };
}
