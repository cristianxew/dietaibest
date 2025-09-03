/**
 * Nutrition Cache Service
 *
 * Provides caching for nutrition data with LRU eviction and TTL support.
 * Caches both local database lookups and USDA API responses.
 *
 * Features:
 * - In-memory LRU cache with configurable size
 * - TTL (time-to-live) for cache entries
 * - Statistics tracking for monitoring
 * - JSON serialization for complex objects
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  hits: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

export class NutritionCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly ttl: number; // Time to live in milliseconds
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
  };

  constructor(maxSize = 1000, ttlMinutes = 60) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttl = ttlMinutes * 60 * 1000;
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update hit count and move to end (LRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.data;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    // Evict oldest entry if at max size
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      hits: 0,
    };

    this.cache.set(key, entry);
  }

  /**
   * Check if an entry has expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp > this.ttl;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  /**
   * Remove expired entries
   */
  cleanup(): number {
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  /**
   * Get all keys in cache
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all entries (for debugging)
   */
  entries(): Array<[string, T]> {
    const result: Array<[string, T]> = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        result.push([key, entry.data]);
      }
    }

    return result;
  }

  /**
   * Warm up cache with pre-loaded data
   */
  warmUp(entries: Array<[string, T]>): void {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  /**
   * Export cache to JSON (for persistence)
   */
  toJSON(): string {
    const data: Array<{
      key: string;
      value: T;
      timestamp: number;
      hits: number;
    }> = [];

    for (const [key, entry] of this.cache.entries()) {
      if (!this.isExpired(entry)) {
        data.push({
          key,
          value: entry.data,
          timestamp: entry.timestamp,
          hits: entry.hits,
        });
      }
    }

    return JSON.stringify(data);
  }

  /**
   * Import cache from JSON
   */
  fromJSON(json: string): void {
    try {
      const data = JSON.parse(json) as Array<{
        key: string;
        value: T;
        timestamp: number;
        hits: number;
      }>;

      this.clear();

      for (const item of data) {
        const entry: CacheEntry<T> = {
          data: item.value,
          timestamp: item.timestamp,
          hits: item.hits,
        };

        if (!this.isExpired(entry)) {
          this.cache.set(item.key, entry);
        }
      }
    } catch (error) {
      console.error("Failed to import cache from JSON:", error);
    }
  }
}

// Singleton instance for nutrition data
let nutritionCacheInstance: NutritionCache | null = null;

/**
 * Get or create the singleton nutrition cache instance
 */
export function getNutritionCache(): NutritionCache {
  if (!nutritionCacheInstance) {
    // Create with 1000 entries max and 60 minute TTL
    nutritionCacheInstance = new NutritionCache(1000, 60);

    // Set up periodic cleanup (every 10 minutes)
    if (typeof setInterval !== "undefined") {
      setInterval(() => {
        nutritionCacheInstance?.cleanup();
      }, 10 * 60 * 1000);
    }
  }

  return nutritionCacheInstance;
}

/**
 * Clear the nutrition cache
 */
export function clearNutritionCache(): void {
  nutritionCacheInstance?.clear();
}

/**
 * Get nutrition cache statistics
 */
export function getNutritionCacheStats(): CacheStats | null {
  return nutritionCacheInstance?.getStats() || null;
}
