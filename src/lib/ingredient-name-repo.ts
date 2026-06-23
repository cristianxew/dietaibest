/**
 * Cached ingredient-name canonicalization.
 *
 * Reads/writes IngredientNameCache and only calls the LLM for cache misses.
 * Gated by INGREDIENT_LLM_FALLBACK — when off, returns an empty map and never
 * touches the DB or the model. Mappings are stable, so a name is canonicalized
 * at most once system-wide (nulls cached too, so confirmed non-foods aren't
 * re-queried).
 *
 * @module lib/ingredient-name-repo
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getIngredientCanonicalizer,
  type MacroEstimate,
} from "./ingredient-canonicalizer";

function normalizeNameKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/\s+/g, " ");
}

export async function canonicalizeCached(
  rawNames: string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  if (process.env.INGREDIENT_LLM_FALLBACK !== "1" || rawNames.length === 0) {
    return out;
  }

  const unique = [...new Set(rawNames)];
  const keyOf = new Map(unique.map((n) => [n, normalizeNameKey(n)]));
  const keys = [...new Set(keyOf.values())];

  const cached = await prisma.ingredientNameCache.findMany({
    where: { key: { in: keys } },
  });
  const byKey = new Map<string, string | null>(
    cached.map((r) => [r.key, r.canonical])
  );

  const misses = unique.filter((n) => !byKey.has(keyOf.get(n)!));
  if (misses.length > 0) {
    const fresh = await getIngredientCanonicalizer().canonicalize(misses);
    for (const raw of misses) {
      // Only cache names the LLM actually returned. A transient LLM failure
      // yields an empty map; caching null for those would permanently mark a
      // real food as "not a food". Leave them unmapped so they retry next time.
      if (!fresh.has(raw)) continue;
      const key = keyOf.get(raw)!;
      const canonical = fresh.get(raw)!;
      byKey.set(key, canonical);
      await prisma.ingredientNameCache.upsert({
        where: { key },
        create: { key, canonical },
        update: { canonical, lastFetchedAt: new Date() },
      });
    }
  }

  for (const raw of rawNames) {
    out.set(raw, byKey.get(keyOf.get(raw)!) ?? null);
  }
  return out;
}

/**
 * Per-100g macro estimates for canonical foods USDA does not carry — the last
 * resort in the coverage chain (FDC → estimate → honest gap). Gated by the same
 * INGREDIENT_LLM_FALLBACK flag; off → empty map (no LLM/DB), so the ingredient
 * degrades to an honest UNRECOGNIZED instead of a silent zero.
 *
 * Cached system-wide in `IngredientEstimateCache`, keyed by the normalized
 * canonical name, so a novel food is estimated at most once. Mirrors
 * `canonicalizeCached`: only successful (non-null) estimates are persisted — a
 * transient/declined estimate is left to retry, never poisoned. Best-effort: an
 * LLM failure yields an empty map and the caller falls through to UNRECOGNIZED.
 */
export async function getMacroEstimates(
  names: string[]
): Promise<Map<string, MacroEstimate | null>> {
  const out = new Map<string, MacroEstimate | null>();
  if (process.env.INGREDIENT_LLM_FALLBACK !== "1" || names.length === 0) {
    return out;
  }

  const unique = [...new Set(names)];
  const keyOf = new Map(unique.map((n) => [n, normalizeNameKey(n)]));
  const keys = [...new Set(keyOf.values())];

  const cached = await prisma.ingredientEstimateCache.findMany({
    where: { name: { in: keys } },
  });
  const byKey = new Map<string, MacroEstimate | null>(
    cached.map((r) => [
      r.name,
      { kcal: r.kcal, protein: r.protein, fat: r.fat, carbs: r.carbs, fiber: r.fiber },
    ])
  );

  const misses = unique.filter((n) => !byKey.has(keyOf.get(n)!));
  if (misses.length > 0) {
    const fresh = await getIngredientCanonicalizer().estimateMacros(misses);
    for (const raw of misses) {
      // A name the LLM didn't return (transient failure) stays unmapped to retry.
      if (!fresh.has(raw)) continue;
      const key = keyOf.get(raw)!;
      const est = fresh.get(raw)!;
      byKey.set(key, est);
      // Only persist a real estimate; a null (declined) is not cached.
      if (est) {
        await prisma.ingredientEstimateCache.upsert({
          where: { name: key },
          create: { name: key, ...est },
          update: { ...est, lastFetchedAt: new Date() },
        });
      }
    }
  }

  for (const n of names) {
    out.set(n, byKey.get(keyOf.get(n)!) ?? null);
  }
  return out;
}
