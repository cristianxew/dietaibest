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
import { getIngredientCanonicalizer } from "./ingredient-canonicalizer";

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
