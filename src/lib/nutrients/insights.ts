/**
 * Deterministic comparison insights — the rule engine behind chips like
 * "Banana has 3× more potassium". No LLM involved: thresholds are
 * ratio + absolute-floor pairs per nutrient, sentences are rendered by
 * the UI from structured data via localized ICU messages.
 *
 * A rule only fires when BOTH sides know the nutrient — absent data
 * never awards a win.
 *
 * @module lib/nutrients/insights
 */

import type { NutrientVector } from "@/lib/nutrients/extract";
import {
  NUTRIENT_REGISTRY,
  type NutrientKey,
} from "@/lib/nutrients/registry";

export interface InsightRuleConfig {
  nutrient: NutrientKey;
  /** Minimum winner/loser ratio for a "timesMore" insight */
  ratioMin: number;
  /** Absolute floor in the nutrient's unit — silences trivial differences */
  minAbsDiff: number;
}

export type InsightKind = "timesMore" | "moreBy" | "onlyOneHas";

export interface Insight {
  nutrient: NutrientKey;
  /** Side with the HIGHER amount (for limit nutrients that's the caution side) */
  winner: "a" | "b";
  kind: InsightKind;
  sentiment: "positive" | "caution";
  /** Present for timesMore: 1 decimal under 3, integer from 3 up */
  times?: number;
  /** Present for moreBy: absolute difference in the nutrient's unit */
  diff?: number;
  /** log2 of the effective ratio — used to rank chips */
  significance: number;
}

export const DEFAULT_INSIGHT_RULES: InsightRuleConfig[] = [
  // goal nutrients — more is a win
  { nutrient: "protein", ratioMin: 1.3, minAbsDiff: 5 },
  { nutrient: "fiber", ratioMin: 1.5, minAbsDiff: 2 },
  { nutrient: "potassium", ratioMin: 1.5, minAbsDiff: 100 },
  { nutrient: "calcium", ratioMin: 1.5, minAbsDiff: 100 },
  { nutrient: "iron", ratioMin: 1.5, minAbsDiff: 1 },
  { nutrient: "magnesium", ratioMin: 1.5, minAbsDiff: 40 },
  { nutrient: "zinc", ratioMin: 1.5, minAbsDiff: 1.5 },
  { nutrient: "vitaminA", ratioMin: 2, minAbsDiff: 100 },
  { nutrient: "vitaminC", ratioMin: 2, minAbsDiff: 10 },
  { nutrient: "vitaminD", ratioMin: 2, minAbsDiff: 2 },
  { nutrient: "vitaminE", ratioMin: 2, minAbsDiff: 3 },
  { nutrient: "vitaminK", ratioMin: 2, minAbsDiff: 20 },
  { nutrient: "vitaminB6", ratioMin: 2, minAbsDiff: 0.3 },
  { nutrient: "vitaminB12", ratioMin: 2, minAbsDiff: 0.5 },
  { nutrient: "folate", ratioMin: 2, minAbsDiff: 50 },
  // limit nutrients — more is a caution
  { nutrient: "sugar", ratioMin: 1.5, minAbsDiff: 5 },
  { nutrient: "satFat", ratioMin: 1.5, minAbsDiff: 2 },
  { nutrient: "sodium", ratioMin: 1.5, minAbsDiff: 120 },
  { nutrient: "cholesterol", ratioMin: 1.5, minAbsDiff: 50 },
];

function roundTimes(ratio: number): number {
  return ratio < 3 ? Math.round(ratio * 10) / 10 : Math.round(ratio);
}

export function computeInsights(
  a: NutrientVector,
  b: NutrientVector,
  rules: InsightRuleConfig[] = DEFAULT_INSIGHT_RULES
): Insight[] {
  const insights: Insight[] = [];

  for (const rule of rules) {
    const valueA = a[rule.nutrient];
    const valueB = b[rule.nutrient];
    if (valueA === undefined || valueB === undefined) continue;

    const hi = Math.max(valueA, valueB);
    const lo = Math.min(valueA, valueB);
    if (hi - lo < rule.minAbsDiff) continue;

    const winner: "a" | "b" = valueA >= valueB ? "a" : "b";
    const direction = NUTRIENT_REGISTRY[rule.nutrient].direction;
    const sentiment = direction === "limit" ? "caution" : "positive";

    // Effective ratio floors the loser to a tenth of the abs threshold so
    // near-zero denominators rank high without dividing by zero.
    const nearZero = rule.minAbsDiff / 10;
    const effectiveRatio = hi / Math.max(lo, nearZero);
    const significance = Math.log2(effectiveRatio);

    if (lo < nearZero) {
      insights.push({
        nutrient: rule.nutrient,
        winner,
        kind: "onlyOneHas",
        sentiment,
        significance,
      });
    } else if (effectiveRatio >= rule.ratioMin) {
      insights.push({
        nutrient: rule.nutrient,
        winner,
        kind: "timesMore",
        sentiment,
        times: roundTimes(effectiveRatio),
        significance,
      });
    } else {
      insights.push({
        nutrient: rule.nutrient,
        winner,
        kind: "moreBy",
        sentiment,
        diff: Math.round((hi - lo) * 10) / 10,
        significance,
      });
    }
  }

  return insights.sort((x, y) => y.significance - x.significance);
}
