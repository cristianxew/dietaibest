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

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fdcRepo", () => ({
  getFoodsCached: vi.fn(),
  searchFoodsCached: vi.fn(),
}));
// The two LLM stages are replayed from recorded fixtures (no Vertex in CI).
vi.mock("@/lib/ingredient-name-repo", () => ({
  canonicalizeCached: vi.fn(),
  getMacroEstimates: vi.fn(),
}));
vi.mock("@/lib/recipe-analysis-repo", () => ({
  runRecipeStage2: vi.fn(),
  getRecipeAnalysisCached: vi.fn(),
  saveRecipeAnalysis: vi.fn(),
}));

import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import {
  canonicalizeCached,
  getMacroEstimates,
} from "@/lib/ingredient-name-repo";
import {
  runRecipeStage2,
  getRecipeAnalysisCached,
  saveRecipeAnalysis,
} from "@/lib/recipe-analysis-repo";
import {
  analyzeRecipeProfileAction,
  type AnalyzeProfileResult,
} from "@/actions/analyzeRecipe";
import { goldenRecipes, type GoldenRecipe } from "./fixtures/recipes";
import {
  searchFromStore,
  foodsFromStore,
  canonicalMapFromStore,
  estimatesMapFromStore,
  stage2FromStore,
  type FdcFixtureStore,
  type LlmFixtureStore,
} from "./lib/replay";
import {
  checkInvariants,
  compareMacros,
  macrosPass,
} from "./lib/assert-macros";
import recordedStoreJson from "./fixtures/fdc/recorded-store.json";
import recordedLlmJson from "./fixtures/llm/recorded-llm.json";

const store = recordedStoreJson as unknown as FdcFixtureStore;
const llm = recordedLlmJson as unknown as LlmFixtureStore;
const realRecipes = goldenRecipes.filter((r) => r.tier === "real");

beforeAll(() => {
  vi.mocked(searchFoodsCached).mockImplementation(async (q: string) =>
    searchFromStore(store, q)
  );
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    foodsFromStore(store, ids)
  );
  // Stage 1 seams replay by name from the recorded LLM store.
  vi.mocked(canonicalizeCached).mockImplementation(async (names: string[]) =>
    canonicalMapFromStore(llm, names)
  );
  vi.mocked(getMacroEstimates).mockImplementation(async (names: string[]) =>
    estimatesMapFromStore(llm, names)
  );
  // The analysis cache is bypassed so the full pipeline runs every time.
  vi.mocked(getRecipeAnalysisCached).mockResolvedValue(null);
  vi.mocked(saveRecipeAnalysis).mockResolvedValue(undefined);
});

beforeEach(() => {
  // Stage 2 is recipe-scoped; each test sets it to the current recipe's fixture.
  vi.mocked(runRecipeStage2).mockReset();
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

describe("golden recipes (real tier)", () => {
  for (const recipe of realRecipes) {
    it(`${recipe.id}: per-serving macros within real tolerance`, async () => {
      vi.mocked(runRecipeStage2).mockResolvedValue(
        stage2FromStore(llm, recipe.id)
      );

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
