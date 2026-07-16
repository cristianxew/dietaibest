/**
 * Deterministic replay store for the nutrition harness.
 *
 * The only USDA-touching seam inside `resolveIngredientMatches` is
 * `searchFoodsCached` + `getFoodsCached` (`@/lib/fdcRepo`). The harness mocks
 * those two and serves them from a committed fixture store so the real pipeline
 * (parse → match → resolve grams → scale → aggregate) runs with zero network
 * and identical results on every run / in CI.
 *
 * The store can be hand-built (anchor fixtures) or produced by the live recorder
 * (`record-fixtures.ts`); both share this shape and these lookups.
 *
 * @module tests/eval/nutrition/lib/replay
 */

import { type FdcFood, type FdcSearchFood } from "@/lib/fdc";
import type { MacroEstimate } from "@/lib/ingredient-canonicalizer";
import type { RecipeAnalysis } from "@/lib/recipe-analyzer";

export interface FdcFixtureStore {
  /** Recorded search hits, keyed by `normalizeKey(query)`. */
  search: Record<string, FdcSearchFood[]>;
  /** Recorded food details, keyed by fdcId. */
  foods: Record<number, FdcFood>;
}

/**
 * Recorded outputs of the two LLM stages, so the real tier replays the
 * canonicalization + estimate + Stage-2 work deterministically (no Vertex calls
 * in CI). Captured by `record-fixtures.test.ts` from the live pipeline's DB
 * caches; served back through the mocked `ingredient-name-repo` /
 * `recipe-analysis-repo` seams.
 */
export interface LlmFixtureStore {
  /** Stage 1: `normalizeKey(rawName)` → canonical English name, or null = not a food. */
  canonical: Record<string, string | null>;
  /** Stage 1: `normalizeKey(canonicalName)` → per-100g macro estimate (miss path). */
  estimates: Record<string, MacroEstimate | null>;
  /** Stage 2: recipe id → recorded recipe analysis (cooked/retention + labels). */
  stage2: Record<string, RecipeAnalysis>;
}

/** A no-op Stage-2 result (no adjustment, no labels). */
export const EMPTY_STAGE2: RecipeAnalysis = {
  perIngredient: [],
  dietLabels: [],
  healthLabels: [],
};

/** Lookup key for a search query — must match between recorder and replay. */
export function normalizeKey(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ");
}

export function searchFromStore(
  store: FdcFixtureStore,
  query: string
): FdcSearchFood[] {
  return store.search[normalizeKey(query)] ?? [];
}

export function foodsFromStore(
  store: FdcFixtureStore,
  ids: number[]
): FdcFood[] {
  return ids.map((id) => store.foods[id]).filter((f): f is FdcFood => Boolean(f));
}

/**
 * Replay `canonicalizeCached`: map each requested raw name to its recorded
 * canonical (key-normalized). An unrecorded name maps to null — the pipeline
 * then keeps the raw name, exactly as a flag-off / cache-miss would.
 */
export function canonicalMapFromStore(
  store: LlmFixtureStore,
  names: string[]
): Map<string, string | null> {
  return new Map(
    names.map((n) => [n, store.canonical[normalizeKey(n)] ?? null])
  );
}

/** Replay `getMacroEstimates`: recorded per-100g estimate per canonical name. */
export function estimatesMapFromStore(
  store: LlmFixtureStore,
  names: string[]
): Map<string, MacroEstimate | null> {
  return new Map(
    names.map((n) => [n, store.estimates[normalizeKey(n)] ?? null])
  );
}

/** Replay `runRecipeStage2`: the recorded analysis for a recipe id, else empty. */
export function stage2FromStore(
  store: LlmFixtureStore,
  recipeId: string
): RecipeAnalysis {
  return store.stage2[recipeId] ?? EMPTY_STAGE2;
}
