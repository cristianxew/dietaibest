/**
 * Golden-recipe harness — REAL tier (replay over recorded live-USDA fixtures).
 *
 * Runs the real pipeline against `fixtures/fdc/recorded-store.json` (captured by
 * `record-fixtures.test.ts`) and asserts per-serving macros against published
 * label values within the loose `real` tolerance + structural invariants.
 *
 * Separate file from the anchor runner because each needs its own fdcRepo mock /
 * store: anchors use hand-built foods (exact math), real recipes use recorded
 * USDA payloads.
 *
 * @module tests/eval/nutrition/golden-recipes-real.test
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fdcRepo", () => ({
  getFoodsCached: vi.fn(),
  searchFoodsCached: vi.fn(),
}));

import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import {
  analyzeRecipeProfileAction,
  type AnalyzeProfileResult,
} from "@/actions/analyzeRecipe";
import { goldenRecipes, type GoldenRecipe } from "./fixtures/recipes";
import {
  searchFromStore,
  foodsFromStore,
  type FdcFixtureStore,
} from "./lib/replay";
import {
  checkInvariants,
  compareMacros,
  macrosPass,
} from "./lib/assert-macros";
import recordedStoreJson from "./fixtures/fdc/recorded-store.json";

const store = recordedStoreJson as unknown as FdcFixtureStore;
const realRecipes = goldenRecipes.filter((r) => r.tier === "real");

// Opt-in: the real tier is currently a MEASUREMENT baseline, not a green gate —
// these recipes expose live Polish name-canonicalization gaps (see the harness
// section of .agent/System/nutrition_units.md). Run with RUN_REAL_EVAL=1. Once
// the gaps are fixed and recipes pass, promote this into the CI gate.
const ENABLED = process.env.RUN_REAL_EVAL === "1";

beforeAll(() => {
  vi.mocked(searchFoodsCached).mockImplementation(async (q: string) =>
    searchFromStore(store, q)
  );
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    foodsFromStore(store, ids)
  );
});

function trace(r: GoldenRecipe, result: AnalyzeProfileResult): string {
  const items = result.items
    .map(
      (it) =>
        `    ${it.name.padEnd(28)} → ${it.fdcId ?? "—"} ${(it.description ?? "")
          .slice(0, 32)
          .padEnd(32)} ${String(it.gramsTotal).padStart(6)}g  c${it.confidence}`
    )
    .join("\n");
  const ps = result.perServing;
  const pct = (a: number, e?: number) =>
    e ? `${(((a - e) / e) * 100).toFixed(0)}%` : "—";
  return (
    `\n[${r.id}]\n` +
    `    kcal ${ps.calories.toFixed(0)}/${r.expected.calories} (${pct(
      ps.calories,
      r.expected.calories
    )})  P ${ps.protein.toFixed(0)}/${r.expected.protein} (${pct(
      ps.protein,
      r.expected.protein
    )})  C ${ps.carbs.toFixed(0)}/${r.expected.carbs} (${pct(
      ps.carbs,
      r.expected.carbs
    )})  F ${ps.fat.toFixed(0)}/${r.expected.fat} (${pct(
      ps.fat,
      r.expected.fat
    )})\n${items}`
  );
}

describe.skipIf(!ENABLED)("golden recipes (real tier)", () => {
  for (const recipe of realRecipes) {
    it(`${recipe.id}: per-serving macros within real tolerance`, async () => {
      const result = await analyzeRecipeProfileAction({
        ingredients: recipe.ingredients,
        servings: recipe.servings,
      });

      const report = trace(recipe, result);
      // Always surface the measurement, pass or fail.
      console.log(report);

      const violations = checkInvariants(result, recipe.servings);
      expect(violations, `invariants:${report}`).toEqual([]);

      const comparisons = compareMacros(
        result.perServing,
        recipe.expected,
        recipe.tier
      );
      expect(macrosPass(comparisons), report).toBe(true);
    });
  }
});
