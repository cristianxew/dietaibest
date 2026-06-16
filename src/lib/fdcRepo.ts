/**
 * FDC Cache Repository Layer
 * Manages intelligent caching of USDA FoodData Central data with TTL strategy
 *
 * TTL Strategy:
 * - Foundation/Survey (FNDDS)/SR Legacy: 180 days (stable data)
 * - Branded: 30 days (products may change more frequently)
 *
 * @module lib/fdcRepo
 */

import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import {
  fdcFoodsByIds,
  MICRO_NUTRIENT_NUMBERS,
  type FdcFood,
} from "@/lib/fdc";

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Time-to-live (TTL) for different data types in milliseconds
 */
const TTL_BY_DATATYPE: Record<string, number> = {
  Foundation: 180 * MS_DAY,
  "Survey (FNDDS)": 180 * MS_DAY,
  "SR Legacy": 180 * MS_DAY,
  Branded: 30 * MS_DAY,
};

/**
 * Check if a cached entry is stale based on its data type and last fetch time
 *
 * @param dataType - FDC data type (Foundation, Survey, SR Legacy, Branded)
 * @param lastFetchedAt - Timestamp of last fetch
 * @returns True if the entry should be refreshed
 */
function isStale(
  dataType: string | null | undefined,
  lastFetchedAt: Date | null | undefined
): boolean {
  if (!lastFetchedAt) return true;

  const ttl = TTL_BY_DATATYPE[dataType ?? "Foundation"] ?? 90 * MS_DAY;
  return Date.now() - lastFetchedAt.getTime() > ttl;
}

const MICRO_NUMBER_SET = new Set(MICRO_NUTRIENT_NUMBERS);

/**
 * Detect legacy cache rows that predate the full-profile schema. Older rows
 * were stored with only the 5 core macros; they carry none of the 17
 * micronutrient numbers, so we treat them as stale to force a one-time
 * refetch of the complete profile (self-healing, no DB migration).
 *
 * Note: a food that genuinely reports none of the 17 micros would refetch on
 * every access. That set is negligible (virtually every food has sodium /
 * potassium / calcium), so the cost is acceptable.
 */
function lacksFullProfile(foodNutrients: unknown): boolean {
  if (!Array.isArray(foodNutrients)) return true;
  return !foodNutrients.some((fn) => {
    const num =
      (fn as { nutrient?: { number?: string }; nutrientNumber?: string })
        ?.nutrient?.number ??
      (fn as { nutrientNumber?: string })?.nutrientNumber;
    return num != null && MICRO_NUMBER_SET.has(String(num));
  });
}

/**
 * Get food data for multiple FDC IDs with intelligent caching
 *
 * Logic Flow:
 * 1. Query FdcCache for requested fdcIds
 * 2. Check if cached entries are stale based on dataType and lastFetchedAt
 * 3. Identify missing or stale entries
 * 4. Fetch missing/stale from USDA API using fdcFoodsByIds()
 * 5. Upsert fetched data into FdcCache with new lastFetchedAt timestamp
 * 6. Return combined cached + fresh data in requested order
 *
 * @param fdcIds - Array of FDC food IDs to fetch
 * @returns Array of food objects with nutritional data, in same order as input
 */
export async function getFoodsCached(fdcIds: number[]): Promise<FdcFood[]> {
  if (!fdcIds.length) return [];

  // 1. Query existing cache entries
  const cached = await prisma.fdcCache.findMany({
    where: { fdcId: { in: fdcIds } },
  });

  const missingOrStale = new Set<number>();
  const byId = new Map<number, FdcFood>();

  // 2. Check which entries are still fresh. Legacy rows that predate the
  // full-profile schema (core-only) are refreshed even if within TTL.
  for (const row of cached) {
    if (
      isStale(row.dataType, row.lastFetchedAt) ||
      lacksFullProfile(row.foodNutrients)
    ) {
      missingOrStale.add(row.fdcId);
    } else {
      // Entry is fresh, reconstruct food object from cache
      byId.set(row.fdcId, {
        fdcId: row.fdcId,
        description: row.description,
        dataType: row.dataType,
        brandOwner: row.brandOwner ?? undefined,
        foodPortions: row.foodPortions as unknown as FdcFood["foodPortions"],
        foodNutrients: row.foodNutrients as unknown as FdcFood["foodNutrients"],
        labelNutrients:
          row.labelNutrients as unknown as FdcFood["labelNutrients"],
      });
    }
  }

  // 3. Identify completely missing entries
  for (const id of fdcIds) {
    if (!byId.has(id)) {
      missingOrStale.add(id);
    }
  }

  // 4. Fetch missing/stale entries from USDA API
  if (missingOrStale.size > 0) {
    console.log(
      `[FDC Cache] Fetching ${missingOrStale.size} missing/stale entries from USDA API`
    );

    try {
      const fetched = await fdcFoodsByIds([...missingOrStale]);

      // 5. Upsert fetched data into cache
      for (const food of fetched) {
        await prisma.fdcCache.upsert({
          where: { fdcId: food.fdcId },
          update: {
            description: food.description,
            dataType: food.dataType,
            brandOwner: food.brandOwner ?? null,
            foodPortions: food.foodPortions as unknown as Prisma.InputJsonValue,
            foodNutrients:
              food.foodNutrients as unknown as Prisma.InputJsonValue,
            labelNutrients:
              food.labelNutrients as unknown as Prisma.InputJsonValue,
            lastFetchedAt: new Date(),
          },
          create: {
            fdcId: food.fdcId,
            description: food.description,
            dataType: food.dataType ?? "Foundation",
            brandOwner: food.brandOwner ?? null,
            foodPortions: food.foodPortions as unknown as Prisma.InputJsonValue,
            foodNutrients:
              food.foodNutrients as unknown as Prisma.InputJsonValue,
            labelNutrients:
              food.labelNutrients as unknown as Prisma.InputJsonValue,
          },
        });

        byId.set(food.fdcId, food);
      }

      console.log(`[FDC Cache] Successfully cached ${fetched.length} entries`);
    } catch (error) {
      console.error("[FDC Cache] Error fetching from USDA API:", error);
      // Don't throw - return whatever we have cached even if stale
      // This provides graceful degradation when API is unavailable
    }
  } else {
    console.log(
      `[FDC Cache] All ${fdcIds.length} entries found in cache (cache hit)`
    );
  }

  // 6. Return data in same order as input fdcIds array
  return fdcIds
    .map((id) => byId.get(id))
    .filter((food): food is FdcFood => food !== undefined);
}

/**
 * Clear all stale entries from the cache
 * Useful for maintenance or when cache gets too large
 *
 * @returns Number of entries deleted
 */
export async function clearStaleCache(): Promise<number> {
  const allCached = await prisma.fdcCache.findMany();
  const idsToDelete: number[] = [];

  for (const entry of allCached) {
    if (isStale(entry.dataType, entry.lastFetchedAt)) {
      idsToDelete.push(entry.fdcId);
    }
  }

  if (idsToDelete.length > 0) {
    const result = await prisma.fdcCache.deleteMany({
      where: { fdcId: { in: idsToDelete } },
    });

    console.log(`[FDC Cache] Cleared ${result.count} stale entries`);
    return result.count;
  }

  return 0;
}

/**
 * Get cache statistics for monitoring
 *
 * @returns Object with cache statistics
 */
export async function getCacheStats() {
  const total = await prisma.fdcCache.count();
  const allCached = await prisma.fdcCache.findMany({
    select: { dataType: true, lastFetchedAt: true },
  });

  let staleCount = 0;
  const byDataType: Record<string, number> = {};

  for (const entry of allCached) {
    if (isStale(entry.dataType, entry.lastFetchedAt)) {
      staleCount++;
    }
    byDataType[entry.dataType] = (byDataType[entry.dataType] ?? 0) + 1;
  }

  return {
    total,
    fresh: total - staleCount,
    stale: staleCount,
    byDataType,
  };
}
