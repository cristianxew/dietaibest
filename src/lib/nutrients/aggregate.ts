/**
 * Recipe-level nutrient aggregation: sums gram-scaled per-100g vectors
 * from matched ingredients into total + per-serving profiles, tracking
 * how much of the recipe the matches actually cover.
 *
 * Pure module — the server action resolves FDC data and ownership;
 * this only does math.
 *
 * @module lib/nutrients/aggregate
 */

import {
  addVectors,
  scaleVector,
  type NutrientVector,
} from "@/lib/nutrients/extract";

export interface IngredientContribution {
  /** Resolved gram weight of this ingredient in the recipe */
  gramWeight: number;
  /** Nutrients per 100g from the matched FDC food */
  vectorPer100g: NutrientVector;
}

export type NutrientCoverage = "full" | "partial" | "macrosOnly";

export interface RecipeAggregation {
  perServing: NutrientVector;
  total: NutrientVector;
  coverage: NutrientCoverage;
  matchedIngredients: number;
  totalIngredients: number;
}

export function aggregateRecipeNutrients(
  contributions: IngredientContribution[],
  unmatchedCount: number,
  servings: number
): RecipeAggregation {
  const safeServings = servings > 0 ? servings : 1;

  const total = contributions.reduce<NutrientVector>(
    (sum, { gramWeight, vectorPer100g }) =>
      addVectors(sum, scaleVector(vectorPer100g, gramWeight / 100)),
    {}
  );

  const matchedIngredients = contributions.length;
  const coverage: NutrientCoverage =
    matchedIngredients === 0
      ? "macrosOnly"
      : unmatchedCount > 0
        ? "partial"
        : "full";

  return {
    perServing: scaleVector(total, 1 / safeServings),
    total,
    coverage,
    matchedIngredients,
    totalIngredients: matchedIngredients + unmatchedCount,
  };
}
