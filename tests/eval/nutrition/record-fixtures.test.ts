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

import { beforeAll, describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import type { FdcFood, FdcSearchFood } from "@/lib/fdc";
import type { RecipeAnalysis } from "@/lib/recipe-analyzer";
import type { MacroEstimate } from "@/lib/ingredient-canonicalizer";
import { goldenRecipes } from "./fixtures/recipes";
import {
  normalizeKey,
  type FdcFixtureStore,
  type LlmFixtureStore,
} from "./lib/replay";

const ENABLED = process.env.RECORD_FDC === "1";
const OUT = path.resolve(__dirname, "fixtures/fdc/recorded-store.json");
const LLM_OUT = path.resolve(__dirname, "fixtures/llm/recorded-llm.json");
/** Mirror of analyzeRecipe's MAX_CANDIDATES_PER_INGREDIENT. */
const MAX_CANDIDATES = 5;

describe.skipIf(!ENABLED)("record fdc fixtures (live)", () => {
  // Invalidate the caches the recorder reads BEFORE either test runs, so the
  // whole recording reflects the CURRENT prompts + R1/R2/R3 logic — not stale
  // rows from a previous run. Critically this includes the SEARCH cache (so the
  // whole-food-first search actually fires) and re-canonicalizes (so the new
  // canonical names + their searches land in the store, not the old ones).
  beforeAll(async () => {
    process.env.INGREDIENT_LLM_FALLBACK = "1";
    const { parseIngredientLine } = await import("@/lib/ingredients");
    const { canonicalizeCached } = await import("@/lib/ingredient-name-repo");
    const { generateRecipeFingerprint } = await import("@/lib/recipe-fingerprint");
    const { normalizeSearchQuery } = await import("@/lib/fdcRepo");
    const { prisma } = await import("@/lib/prisma");

    const real = goldenRecipes.filter((r) => r.tier === "real");
    const rawNames = [
      ...new Set(
        real.flatMap((r) => r.ingredients.map((l) => parseIngredientLine(l).name))
      ),
    ];
    const fingerprints = real.map((r) =>
      generateRecipeFingerprint({ title: "", ingr: r.ingredients })
    );

    await prisma.recipeAnalysisCache.deleteMany({
      where: { fingerprint: { in: fingerprints } },
    });
    await prisma.ingredientNameCache.deleteMany({
      where: { key: { in: rawNames.map(normalizeKey) } },
    });
    // Re-canonicalize fresh (R2 prompt) to learn the NEW canonical query names,
    // then clear the search + estimate caches keyed by raw AND canonical names.
    const canon = await canonicalizeCached(rawNames);
    const canonNames = [...canon.values()].filter((c): c is string => !!c);
    await prisma.ingredientEstimateCache.deleteMany({
      where: { name: { in: canonNames.map(normalizeKey) } },
    });
    await prisma.fdcSearchCache.deleteMany({
      where: {
        query: {
          in: [...new Set([...rawNames, ...canonNames].map(normalizeSearchQuery))],
        },
      },
    });
  }, 120_000);

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

  it("records the two LLM stages (canonical, estimates, stage 2) for real recipes", async () => {
    // Force the LLM-primary path on so canonicalize/estimate/stage-2 actually run
    // and persist to their caches (the source we dump below).
    process.env.INGREDIENT_LLM_FALLBACK = "1";
    const { parseIngredientLine } = await import("@/lib/ingredients");
    const { analyzeRecipeProfileAction } = await import("@/actions/analyzeRecipe");
    const { generateRecipeFingerprint } = await import("@/lib/recipe-fingerprint");
    const { prisma } = await import("@/lib/prisma");

    const realRecipes = goldenRecipes.filter((r) => r.tier === "real");

    // Raw-name keys + recipe fingerprints for the real recipes.
    const rawKeys = new Set<string>();
    for (const recipe of realRecipes)
      for (const line of recipe.ingredients)
        rawKeys.add(normalizeKey(parseIngredientLine(line).name));
    const fingerprints = realRecipes.map((r) =>
      generateRecipeFingerprint({ title: "", ingr: r.ingredients })
    );
    // (Caches were invalidated in beforeAll, so this run reflects current logic.)

    // Run the live pipeline once per recipe. Beyond returning a result, this
    // PERSISTS all three LLM outputs to their caches (IngredientNameCache,
    // IngredientEstimateCache, RecipeAnalysisCache) — which we dump as the
    // deterministic replay fixture. No title is passed, matching the real runner.
    for (const recipe of realRecipes) {
      await analyzeRecipeProfileAction({
        ingredients: recipe.ingredients,
        servings: recipe.servings,
      });
    }

    // Stage 1 canonical — filter the name cache to the real recipes' raw names.
    const canonicalRows = await prisma.ingredientNameCache.findMany({
      where: { key: { in: [...rawKeys] } },
    });
    const canonical: Record<string, string | null> = {};
    for (const r of canonicalRows) canonical[r.key] = r.canonical;

    // Stage 1 estimates — filter the estimate cache to the canonical names used.
    const canonKeys = new Set<string>();
    for (const c of Object.values(canonical)) if (c) canonKeys.add(normalizeKey(c));
    const estimateRows = await prisma.ingredientEstimateCache.findMany({
      where: { name: { in: [...canonKeys] } },
    });
    const estimates: Record<string, MacroEstimate | null> = {};
    for (const r of estimateRows)
      estimates[r.name] = {
        kcal: r.kcal,
        protein: r.protein,
        fat: r.fat,
        carbs: r.carbs,
        fiber: r.fiber,
      };

    // Stage 2 — read the analysis cache by fingerprint, key by recipe id so the
    // replay runner can look it up without re-deriving the fingerprint.
    const stage2: Record<string, RecipeAnalysis> = {};
    for (const recipe of realRecipes) {
      const fingerprint = generateRecipeFingerprint({
        title: "",
        ingr: recipe.ingredients,
      });
      const row = await prisma.recipeAnalysisCache.findUnique({
        where: { fingerprint },
      });
      if (row) stage2[recipe.id] = row.stage2Json as unknown as RecipeAnalysis;
    }

    const llmStore: LlmFixtureStore = { canonical, estimates, stage2 };
    mkdirSync(path.dirname(LLM_OUT), { recursive: true });
    // Pretty-printed: small, human-reviewable (canonical/estimate sanity check).
    writeFileSync(LLM_OUT, JSON.stringify(llmStore, null, 2) + "\n");

    expect(Object.keys(canonical).length).toBeGreaterThan(0);
  }, 240_000);
});
