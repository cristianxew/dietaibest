/**
 * Golden-recipe nutrition harness (replay mode).
 *
 * Runs the REAL analysis pipeline (`analyzeRecipeProfileAction`) against a
 * committed FDC fixture store — no network, deterministic, CI-safe — and asserts
 * each recipe's per-serving macros against trusted values within its tier
 * tolerance, plus structural plausibility invariants.
 *
 * This is the regression net: any change to parsing, matching, gram resolution,
 * scaling, or aggregation that moves a known recipe's macros out of tolerance
 * fails here, on every PR.
 *
 * @module tests/eval/nutrition/golden-recipes.test
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock the only USDA-touching seam; the rest of the pipeline stays real.
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
import { anchorStore } from "./fixtures/anchor-foods";
import { searchFromStore, foodsFromStore } from "./lib/replay";
import {
  checkInvariants,
  compareMacros,
  macrosPass,
} from "./lib/assert-macros";

beforeAll(() => {
  vi.mocked(searchFoodsCached).mockImplementation(async (q: string) =>
    searchFromStore(anchorStore, q)
  );
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    foodsFromStore(anchorStore, ids)
  );
});

/** Per-ingredient resolution trace, so a failure is debuggable at a glance. */
function debugResult(r: GoldenRecipe, result: AnalyzeProfileResult): string {
  const lines = result.items.map(
    (it) =>
      `  - ${it.name} → fdc ${it.fdcId ?? "none"}, ${it.gramsTotal}g, ` +
      `conf ${it.confidence}, "${it.portionNote}"`
  );
  const ps = result.perServing;
  return (
    `\n[${r.id}] per-serving expected vs actual:\n` +
    `  cal ${r.expected.calories} / ${ps.calories.toFixed(2)}  ` +
    `prot ${r.expected.protein} / ${ps.protein.toFixed(2)}  ` +
    `fat ${r.expected.fat} / ${ps.fat.toFixed(2)}  ` +
    `carb ${r.expected.carbs} / ${ps.carbs.toFixed(2)}  ` +
    `fib ${r.expected.fiber} / ${ps.fiber.toFixed(2)}\n` +
    lines.join("\n")
  );
}

describe("golden recipes (anchor tier)", () => {
  for (const recipe of goldenRecipes.filter((r) => r.tier === "anchor")) {
    it(`${recipe.id}: per-serving macros within ${recipe.tier} tolerance`, async () => {
      const result = await analyzeRecipeProfileAction({
        ingredients: recipe.ingredients,
        servings: recipe.servings,
      });

      const debug = debugResult(recipe, result);

      const violations = checkInvariants(result, recipe.servings);
      expect(
        violations,
        `invariant violations:${debug}\n${JSON.stringify(violations, null, 2)}`
      ).toEqual([]);

      const comparisons = compareMacros(
        result.perServing,
        recipe.expected,
        recipe.tier
      );
      expect(macrosPass(comparisons), debug).toBe(true);
    });
  }
});
