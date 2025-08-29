/**
 * Nutrition Cache Service
 *
 * This service provides a comprehensive caching strategy for nutritional data to improve performance.
 *
 * Features:
 * - In-memory LRU cache for frequent lookups
 * - Database-level caching for analyzed recipes
 * - Cache key generation based on ingredient lists
 * - Cache invalidation strategy for database updates
 * - Cache statistics tracking for monitoring
 * - Cache warming for common ingredients
 * - Configurable cache settings (size, TTL)
 */

import { IngredientNutrient, Nutrient } from "@/generated/prisma";
import prisma from "@/lib/prisma";
import { ParsedIngredient } from "@/utils/ingredientParser";
import { RecipeNutrition } from "@/services/nutritionCalculator";
import { createHash } from "crypto";

// Configuration interface for cache settings
interface CacheConfig {
  memoryMaxSize: number; // Maximum number of items in memory cache
  memoryTTL: number; // Time to live in milliseconds
  databaseTTL: number; // Database cache TTL in milliseconds
  warmupEnabled: boolean; // Whether to warm up cache on startup
  statisticsEnabled: boolean; // Whether to track cache statistics
  preloadCommonIngredients: boolean; // Whether to preload common ingredients
}

// Default cache configuration
const DEFAULT_CONFIG: CacheConfig = {
  memoryMaxSize: 1000,
  memoryTTL: 30 * 60 * 1000, // 30 minutes
  databaseTTL: 24 * 60 * 60 * 1000, // 24 hours
  warmupEnabled: true,
  statisticsEnabled: true,
  preloadCommonIngredients: true,
};

// Cache entry interface
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
}

// Cache statistics interface
interface CacheStats {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memorySize: number;
  memoryMaxSize: number;
  memoryUsage: number;
  databaseCacheSize: number;
  evictions: number;
  warmupTime: number;
  topKeys: Array<{ key: string; hits: number; lastAccessed: number }>;
}

// Cache key types
type CacheKeyType =
  | "ingredient-nutrition"
  | "recipe-nutrition"
  | "diet-classification"
  | "allergen-detection"
  | "ingredient-match"
  | "parsed-ingredients";

// LRU Cache implementation
class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: CacheConfig;
  private stats: CacheStats;

  constructor(config: CacheConfig) {
    this.config = config;
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      memorySize: 0,
      memoryMaxSize: config.memoryMaxSize,
      memoryUsage: 0,
      databaseCacheSize: 0,
      evictions: 0,
      warmupTime: 0,
      topKeys: [],
    };
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    const now = Date.now();

    if (!entry) {
      this.stats.totalMisses++;
      this.updateHitRate();
      return null;
    }

    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.totalMisses++;
      this.updateHitRate();
      return null;
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = now;
    this.stats.totalHits++;
    this.updateHitRate();
    this.updateMemoryStats();

    return entry.data;
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const entryTTL = ttl ?? this.config.memoryTTL;

    // Check if we need to evict old entries
    if (this.cache.size >= this.config.memoryMaxSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: entryTTL,
      hitCount: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
    this.updateMemoryStats();
  }

  delete(key: string): boolean {
    const result = this.cache.delete(key);
    this.updateMemoryStats();
    return result;
  }

  clear(): void {
    this.cache.clear();
    this.updateMemoryStats();
  }

  private evictLeastRecentlyUsed(): void {
    let oldestKey = "";
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  private updateHitRate(): void {
    const total = this.stats.totalHits + this.stats.totalMisses;
    this.stats.hitRate = total > 0 ? this.stats.totalHits / total : 0;
  }

  private updateMemoryStats(): void {
    this.stats.memorySize = this.cache.size;
    this.stats.memoryUsage = this.cache.size / this.config.memoryMaxSize;

    // Update top keys
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        hits: entry.hitCount,
        lastAccessed: entry.lastAccessed,
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 10);

    this.stats.topKeys = entries;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }
}

// Main cache service class
class NutritionCacheService {
  private memoryCache: LRUCache<unknown>;
  private config: CacheConfig;
  private isInitialized: boolean = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryCache = new LRUCache(this.config);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log("Initializing nutrition cache service...");
    const startTime = Date.now();

    try {
      // Clean up expired database cache entries
      await this.cleanupExpiredDatabaseCache();

      // Warm up cache if enabled
      if (this.config.warmupEnabled) {
        await this.warmupCache();
      }

      this.isInitialized = true;
      const warmupTime = Date.now() - startTime;
      console.log(`Cache service initialized in ${warmupTime}ms`);

      // Update warmup time in stats
      const stats = this.memoryCache.getStats();
      stats.warmupTime = warmupTime;
    } catch (error) {
      console.error("Failed to initialize cache service:", error);
      throw error;
    }
  }

  // Generate cache key based on data type and parameters
  generateCacheKey(type: CacheKeyType, ...params: unknown[]): string {
    const dataToHash = JSON.stringify({ type, params });
    return `${type}:${createHash("md5").update(dataToHash).digest("hex")}`;
  }

  // Get from cache (checks memory first, then database)
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult) {
      return memoryResult as T;
    }

    // Check database cache
    const dbResult = await this.getDatabaseCache(key);
    if (dbResult) {
      // Store in memory cache for future access
      this.memoryCache.set(key, dbResult);
      return dbResult as T;
    }

    return null;
  }

  // Set in cache (stores in both memory and database)
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    // Store in memory cache
    this.memoryCache.set(key, data, ttl);

    // Store in database cache
    await this.setDatabaseCache(key, data, ttl ?? this.config.databaseTTL);
  }

  // Delete from cache
  async delete(key: string): Promise<void> {
    // Delete from memory cache
    this.memoryCache.delete(key);

    // Delete from database cache
    await this.deleteDatabaseCache(key);
  }

  // Clear all cache
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear database cache
    await this.clearDatabaseCache();
  }

  // Invalidate cache based on ingredient changes
  async invalidateIngredientCache(ingredientIds: string[]): Promise<void> {
    // For now, we'll do a simple pattern-based invalidation
    // In a production system, you might want to maintain a mapping of cache keys to ingredients
    console.log(
      `Invalidating cache for ingredients: ${ingredientIds.join(", ")}`
    );

    // Clear memory cache (simple approach)
    this.memoryCache.clear();

    // Clear database cache entries that might be affected
    await this.clearDatabaseCache();
  }

  // Get cache statistics
  getStats(): CacheStats {
    return this.memoryCache.getStats();
  }

  // Warm up cache with common ingredients
  private async warmupCache(): Promise<void> {
    if (!this.config.preloadCommonIngredients) return;

    console.log("Warming up cache with common ingredients...");

    try {
      // Get most common ingredients (based on usage or predefined list)
      const commonIngredients = await prisma.ingredient.findMany({
        take: 50,
        include: {
          ingredientNutrients: {
            include: {
              nutrient: true,
            },
          },
        },
        // You might want to order by usage frequency if you track that
        orderBy: {
          name: "asc",
        },
      });

      // Cache common ingredient nutrition data
      for (const ingredient of commonIngredients) {
        const key = this.generateCacheKey(
          "ingredient-nutrition",
          ingredient.id
        );
        await this.set(key, ingredient.ingredientNutrients);
      }

      console.log(
        `Warmed up cache with ${commonIngredients.length} common ingredients`
      );
    } catch (error) {
      console.error("Failed to warm up cache:", error);
    }
  }

  // Database cache operations
  private async getDatabaseCache(key: string): Promise<unknown | null> {
    try {
      const cached = await prisma.nutritionCache.findUnique({
        where: { key },
      });

      if (!cached) return null;

      // Check if expired
      if (Date.now() - cached.createdAt.getTime() > cached.ttl) {
        await this.deleteDatabaseCache(key);
        return null;
      }

      return JSON.parse(cached.data);
    } catch (error) {
      console.error("Error getting database cache:", error);
      return null;
    }
  }

  private async setDatabaseCache(
    key: string,
    data: unknown,
    ttl: number
  ): Promise<void> {
    try {
      await prisma.nutritionCache.upsert({
        where: { key },
        update: {
          data: JSON.stringify(data),
          ttl,
          createdAt: new Date(),
        },
        create: {
          key,
          data: JSON.stringify(data),
          ttl,
        },
      });
    } catch (error) {
      console.error("Error setting database cache:", error);
    }
  }

  private async deleteDatabaseCache(key: string): Promise<void> {
    try {
      await prisma.nutritionCache.delete({
        where: { key },
      });
    } catch (error) {
      console.error("Error deleting database cache:", error);
    }
  }

  private async clearDatabaseCache(): Promise<void> {
    try {
      await prisma.nutritionCache.deleteMany({});
    } catch (error) {
      console.error("Error clearing database cache:", error);
    }
  }

  private async cleanupExpiredDatabaseCache(): Promise<void> {
    try {
      const now = new Date();
      await prisma.nutritionCache.deleteMany({
        where: {
          createdAt: {
            lt: new Date(now.getTime() - this.config.databaseTTL),
          },
        },
      });
    } catch (error) {
      console.error("Error cleaning up expired database cache:", error);
    }
  }
}

// Singleton instance
let cacheService: NutritionCacheService | null = null;

// Get or create cache service instance
export function getCacheService(
  config?: Partial<CacheConfig>
): NutritionCacheService {
  if (!cacheService) {
    cacheService = new NutritionCacheService(config);
  }
  return cacheService;
}

// Initialize cache service
export async function initializeCache(
  config?: Partial<CacheConfig>
): Promise<void> {
  const service = getCacheService(config);
  await service.initialize();
}

// Convenience functions for different cache operations
export async function cacheIngredientNutrition(
  ingredientId: string,
  nutrition: (IngredientNutrient & { nutrient: Nutrient })[]
): Promise<void> {
  const service = getCacheService();
  const key = service.generateCacheKey("ingredient-nutrition", ingredientId);
  await service.set(key, nutrition);
}

export async function getCachedIngredientNutrition(
  ingredientId: string
): Promise<(IngredientNutrient & { nutrient: Nutrient })[] | null> {
  const service = getCacheService();
  const key = service.generateCacheKey("ingredient-nutrition", ingredientId);
  return await service.get(key);
}

export async function cacheRecipeNutrition(
  parsedIngredients: ParsedIngredient[],
  nutrition: RecipeNutrition,
  servings: number = 1
): Promise<void> {
  const service = getCacheService();
  const key = service.generateCacheKey(
    "recipe-nutrition",
    parsedIngredients,
    servings
  );
  await service.set(key, nutrition);
}

export async function getCachedRecipeNutrition(
  parsedIngredients: ParsedIngredient[],
  servings: number = 1
): Promise<RecipeNutrition | null> {
  const service = getCacheService();
  const key = service.generateCacheKey(
    "recipe-nutrition",
    parsedIngredients,
    servings
  );
  return await service.get(key);
}

export async function invalidateIngredientCache(
  ingredientIds: string[]
): Promise<void> {
  const service = getCacheService();
  await service.invalidateIngredientCache(ingredientIds);
}

export async function getCacheStats(): Promise<CacheStats> {
  const service = getCacheService();
  return service.getStats();
}

export async function clearAllCache(): Promise<void> {
  const service = getCacheService();
  await service.clear();
}

// Export types for external use
export type { CacheConfig, CacheStats, CacheKeyType };
export { DEFAULT_CONFIG };
