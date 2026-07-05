/**
 * Multi-objective swap ranking: how well does replacing one planned meal
 * with a candidate recipe close a Finding's week gap — without wrecking
 * other findings or hiding tradeoffs.
 *
 * A naive scorer that fixes fiber with a sodium bomb is worse than no
 * scorer; the penalty term and the honest tradeoffs[] are the point.
 *
 * Pure module.
 *
 * @module lib/nutrients/swap-scorer
 */

import {
  NUTRIENT_REGISTRY,
  type NutrientKey,
  type NutrientUnit,
} from "@/lib/nutrients/registry";
import type { NutrientVector } from "@/lib/nutrients/extract";
import type { NutrientCoverage } from "@/lib/nutrients/aggregate";
import type { Finding, PlannedMealInput } from "@/lib/nutrients/week-analysis";

export interface SwapCandidate {
  recipeId: string;
  title: string;
  perServing: NutrientVector;
  coverage: NutrientCoverage;
  /** Normalized ingredient names/lines for allergen filtering */
  ingredientNames: string[];
}

export interface SwapContext {
  meal: PlannedMealInput;
  /** The finding this swap should fix */
  target: Finding;
  /** All active findings — worsening any of them is penalized */
  findings: Finding[];
  /** Lowercased allergen tokens from UserProfile.allergies */
  allergies: string[];
}

export interface SwapSuggestion {
  mealId: string;
  candidateRecipeId: string;
  candidateTitle: string;
  /** Week-level deltas, only for nutrients both sides know */
  deltas: NutrientVector;
  /** Fraction of the target finding's weekGapAmount this swap closes */
  gapClosure: number;
  /** Nutrients made meaningfully worse by this swap */
  tradeoffs: NutrientKey[];
  score: number;
}

const KCAL_BAND = 0.25;
const MIN_GAP_CLOSURE = 0.05;
const PENALTY_WEIGHT = 0.5;
/** Week-level noise floors per unit — changes below these are not tradeoffs */
const TRADEOFF_FLOOR: Record<NutrientUnit, number> = {
  kcal: 100,
  g: 5,
  mg: 100,
  ug: 20,
};

function hasAllergen(candidate: SwapCandidate, allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const names = candidate.ingredientNames.map((n) => n.toLowerCase());
  return allergies.some((a) => {
    const token = a.trim().toLowerCase();
    return token.length > 0 && names.some((n) => n.includes(token));
  });
}

/** Positive delta hurts limit nutrients; negative delta hurts goal nutrients. */
function worsens(key: NutrientKey, delta: number): boolean {
  const def = NUTRIENT_REGISTRY[key];
  if (def.direction === "limit") return delta > 0;
  if (def.direction === "goal") return delta < 0;
  return false;
}

export function scoreSwaps(
  ctx: SwapContext,
  candidates: SwapCandidate[]
): SwapSuggestion[] {
  const { meal, target, findings, allergies } = ctx;
  const mealKcal = meal.perServing.kcal;
  const suggestions: SwapSuggestion[] = [];

  for (const cand of candidates) {
    if (cand.recipeId === meal.recipeId) continue;
    if (cand.perServing[target.nutrient] === undefined) continue;
    if (meal.perServing[target.nutrient] === undefined) continue;
    if (hasAllergen(cand, allergies)) continue;

    const candKcal = cand.perServing.kcal;
    if (mealKcal === undefined || candKcal === undefined) continue;
    if (Math.abs(candKcal - mealKcal) > KCAL_BAND * mealKcal) continue;

    const deltas: NutrientVector = {};
    for (const key of Object.keys(cand.perServing) as NutrientKey[]) {
      const before = meal.perServing[key];
      if (before === undefined) continue;
      deltas[key] = ((cand.perServing[key] as number) - before) * meal.servings;
    }

    const targetDelta = deltas[target.nutrient] as number;
    const gapClosure =
      target.kind === "excess"
        ? -targetDelta / target.weekGapAmount
        : targetDelta / target.weekGapAmount;
    if (gapClosure < MIN_GAP_CLOSURE) continue;

    let penalty = 0;
    for (const f of findings) {
      if (f.id === target.id) continue;
      const d = deltas[f.nutrient];
      if (d === undefined || f.weekGapAmount <= 0) continue;
      const hurts = f.kind === "deficit" ? d < 0 : d > 0;
      if (hurts) penalty += Math.abs(d) / f.weekGapAmount;
    }

    const tradeoffs = (Object.keys(deltas) as NutrientKey[]).filter((key) => {
      if (key === target.nutrient || key === "kcal") return false;
      const d = deltas[key] as number;
      return (
        worsens(key, d) &&
        Math.abs(d) >= TRADEOFF_FLOOR[NUTRIENT_REGISTRY[key].unit]
      );
    });

    suggestions.push({
      mealId: meal.mealId,
      candidateRecipeId: cand.recipeId,
      candidateTitle: cand.title,
      deltas,
      gapClosure,
      tradeoffs,
      score: gapClosure - PENALTY_WEIGHT * penalty,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}
