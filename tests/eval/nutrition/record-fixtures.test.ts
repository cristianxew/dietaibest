// @vitest-environment node
/**
 * Live FDC fixture recorder (opt-in — NOT part of CI).
 *
 * Runs under the NODE environment (not jsdom): jsdom's fetch mangles Google's
 * OAuth token POST, which breaks Vertex/Gemini auth. Plain node fetch works.
 *
 * Hits the REAL cached USDA layer (`searchFoodsCached` + `getFoodsCached`) for
 * every golden recipe's ingredients and writes a deterministic replay store to
 * `fixtures/fdc/recorded-store.json`. This is where the "live FDC" preference
 * lives: refresh fixtures and detect USDA drift on demand, without ever gating
 * a PR.
 *
 * Run it manually:
 *   bun run eval:nutrition:record
 *   (= RECORD_FDC=1 vitest run tests/eval/nutrition/record-fixtures.test.ts)
 *
 * Requires FDC_API_KEY and DB access (the cache layer reads/writes FdcCache).
 * Set INGREDIENT_LLM_FALLBACK=1 too so it also canonicalizes (Gemini) and records
 * the canonical-name USDA searches the two-pass fallback needs.
 * Skipped entirely unless RECORD_FDC=1. The prisma-/USDA-touching modules are
 * imported dynamically INSIDE the test so collection never loads the generated
 * Prisma client — which is gitignored and absent in the CI eval job.
 *
 * @module tests/eval/nutrition/record-fixtures.test
 */

import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import type { FdcFood, FdcSearchFood } from "@/lib/fdc";
import { goldenRecipes } from "./fixtures/recipes";
import { normalizeKey, type FdcFixtureStore } from "./lib/replay";

const ENABLED = process.env.RECORD_FDC === "1";
const OUT = path.resolve(__dirname, "fixtures/fdc/recorded-store.json");
/** Mirror of analyzeRecipe's MAX_CANDIDATES_PER_INGREDIENT. */
const MAX_CANDIDATES = 5;

describe.skipIf(!ENABLED)("record fdc fixtures (live)", () => {
  it("records search + food payloads for every golden recipe", async () => {
    // generous: sequential live USDA calls for every real-tier ingredient.
    // Dynamic imports: keep the gitignored Prisma client out of collection.
    const { parseIngredientLine } = await import("@/lib/ingredients");
    const { searchFoodsCached, getFoodsCached } = await import("@/lib/fdcRepo");
    const { rankMatches } = await import("@/lib/fdc-match");
    const { stapleFdcId } = await import("@/lib/fdc-staples");
    const { PROFILE_NUTRIENT_NUMBERS } = await import("@/lib/fdc");
    const { canonicalizeCached } = await import("@/lib/ingredient-name-repo");

    // Keep only the nutrient rows the pipeline reads (the 22 profile numbers +
    // the #957/#958 energy alternates), so the committed fixture stays small.
    const keepNutrients = new Set([...PROFILE_NUTRIENT_NUMBERS, "957", "958"]);
    const nutrientNum = (n: { nutrient?: { number?: string }; nutrientNumber?: string }) =>
      String(n.nutrient?.number ?? n.nutrientNumber ?? "");
    const slim = (food: FdcFood): FdcFood => ({
      ...food,
      foodNutrients: (food.foodNutrients ?? []).filter((n) =>
        keepNutrients.has(nutrientNum(n))
      ),
    });

    const search: Record<string, FdcSearchFood[]> = {};
    const foods: Record<number, FdcFood> = {};
    const idsToFetch = new Set<number>();

    // Search one name and mirror the pipeline's candidate selection (staple pin
    // + top-N ranked) so the store covers every id the pipeline will request.
    const recordSearch = async (name: string) => {
      const key = normalizeKey(name);
      if (key in search) return;
      const hits = await searchFoodsCached(name);
      search[key] = hits;
      const ranked = rankMatches(hits, name).slice(0, MAX_CANDIDATES);
      for (const c of ranked) idsToFetch.add(c.fdcId);
      const staple = stapleFdcId(name);
      if (staple !== null) idsToFetch.add(staple);
    };

    const names = new Set<string>();
    for (const recipe of goldenRecipes.filter((r) => r.tier === "real")) {
      for (const line of recipe.ingredients) {
        names.add(parseIngredientLine(line).name);
      }
    }

    for (const name of names) await recordSearch(name);

    // Also record canonical-name searches so the LLM two-pass fallback replays
    // deterministically: canonicalize every name (cache + Gemini for misses) and
    // record the USDA search for each non-null canonical that differs.
    // Requires INGREDIENT_LLM_FALLBACK=1 (else canonicalizeCached returns empty).
    const canonical = await canonicalizeCached([...names]);
    for (const [raw, canon] of canonical) {
      if (canon && canon.toLowerCase() !== raw.toLowerCase()) {
        await recordSearch(canon);
      }
    }

    const fetched = await getFoodsCached([...idsToFetch]);
    for (const food of fetched) foods[food.fdcId] = slim(food);

    const store: FdcFixtureStore = { search, foods };
    mkdirSync(path.dirname(OUT), { recursive: true });
    // Minified: it's a generated fixture, not hand-edited, and size matters.
    writeFileSync(OUT, JSON.stringify(store) + "\n");

    expect(Object.keys(store.foods).length).toBeGreaterThan(0);
  }, 240_000);
});
