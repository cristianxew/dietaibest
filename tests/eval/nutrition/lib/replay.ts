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

export interface FdcFixtureStore {
  /** Recorded search hits, keyed by `normalizeKey(query)`. */
  search: Record<string, FdcSearchFood[]>;
  /** Recorded food details, keyed by fdcId. */
  foods: Record<number, FdcFood>;
}

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
