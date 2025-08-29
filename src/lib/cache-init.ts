/**
 * Cache Initialization Script
 *
 * This script initializes the nutrition cache service on application startup
 * with proper error handling and configuration options.
 */

import { initializeCache } from "@/services/nutritionCache";

// Flag to track if cache has been initialized
let isInitialized = false;

/**
 * Initialize the cache service with custom configuration
 */
export async function initializeCacheService(): Promise<void> {
  if (isInitialized) {
    console.log("Cache service already initialized");
    return;
  }

  try {
    console.log("Initializing nutrition cache service...");

    // Initialize cache with custom configuration based on environment
    const cacheConfig = {
      memoryMaxSize: process.env.NODE_ENV === "production" ? 2000 : 1000,
      memoryTTL: 30 * 60 * 1000, // 30 minutes
      databaseTTL: 24 * 60 * 60 * 1000, // 24 hours
      warmupEnabled: process.env.NODE_ENV === "production",
      statisticsEnabled: true,
      preloadCommonIngredients: true,
    };

    await initializeCache(cacheConfig);

    isInitialized = true;
    console.log("✅ Cache service initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize cache service:", error);
    // Don't throw error to prevent app startup failure
    // The app should work without cache, just with degraded performance
  }
}

/**
 * Check if cache service is initialized
 */
export function isCacheInitialized(): boolean {
  return isInitialized;
}

/**
 * Force re-initialization of cache service
 */
export async function reinitializeCacheService(): Promise<void> {
  console.log("Forcing cache service re-initialization...");
  isInitialized = false;
  await initializeCacheService();
}

// Auto-initialize cache on module import in production
if (process.env.NODE_ENV === "production") {
  initializeCacheService().catch(console.error);
}
