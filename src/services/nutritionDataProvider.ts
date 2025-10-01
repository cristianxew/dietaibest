/**
 * Nutrition Data Provider - Enhanced with Database Persistence
 *
 * Provides a multi-tier caching system for nutrient data lookups:
 * 1. In-memory cache (fastest - sub-millisecond)
 * 2. Database cache (persistent, fast - few milliseconds)
 * 3. USDA API (comprehensive, slower - seconds)
 *
 * This approach ensures optimal performance while building a comprehensive
 * local nutrition database over time.
 */

import { findBestUSDAMatch } from "./usda";
import { getNutritionCache } from "./nutritionCache";
import {
  findIngredientInDatabase,
  storeIngredientNutrition,
  convertDatabaseToNutrientInfo,
  initializeNutrients,
} from "./ingredientNutritionDB";

// Nutrient data structure
export interface NutrientInfo {
  id: string;
  name: string;
  value: number;
  unit: string;
  category: string;
  confidence: number;
  dailyValue?: number;
  source: "local" | "usda" | "cache" | "custom";
}

export interface IngredientNutritionData {
  ingredientName: string;
  nutrients: NutrientInfo[];
  matchConfidence: number;
  source: "local" | "usda" | "cache" | "custom";
  warnings?: string[];
}

// Common nutrient IDs based on USDA standards
export const NUTRIENT_IDS = {
  ENERGY: "usda:1008",
  PROTEIN: "usda:1003",
  FAT: "usda:1004",
  CARBS: "usda:1005",
  FIBER: "usda:1079",
  SUGAR: "usda:2000",
  SODIUM: "usda:1093",
  SATURATED_FAT: "usda:1258",
  CHOLESTEROL: "usda:1253",
  CALCIUM: "usda:1087",
  IRON: "usda:1089",
  POTASSIUM: "usda:1092",
  VITAMIN_A: "usda:1106",
  VITAMIN_C: "usda:1162",
  VITAMIN_D: "usda:1114",
} as const;

/**
 * Enhanced Nutrition Data Provider with Database Persistence
 */
class EnhancedNutritionDataProvider {
  private memoryCache = getNutritionCache();
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the provider and ensure nutrients are set up in database
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = initializeNutrients().catch((error) => {
        console.warn("Failed to initialize nutrients:", error);
      });
    }
    await this.initPromise;
  }

  /**
   * Multi-tier ingredient lookup with automatic USDA fallback and storage
   */
  async getIngredientNutrition(
    ingredientName: string
  ): Promise<IngredientNutritionData | null> {
    await this.ensureInitialized();

    const normalizedName = this.normalizeIngredientName(ingredientName);
    const cacheKey = `ingredient:${normalizedName}`;

    // Tier 1: Check in-memory cache (fastest)
    const memoryResult = this.memoryCache.get(cacheKey);
    if (memoryResult) {
      return memoryResult;
    }

    try {
      // Tier 2: Check database cache (persistent, fast)
      const dbResult = await findIngredientInDatabase(normalizedName);

      if (dbResult.found && dbResult.ingredient) {
        const nutritionData: IngredientNutritionData = {
          ingredientName,
          nutrients: convertDatabaseToNutrientInfo(dbResult.ingredient),
          matchConfidence: dbResult.matchConfidence,
          source: "local",
        };

        // Cache in memory for future requests
        this.memoryCache.set(cacheKey, nutritionData);
        return nutritionData;
      }

      // Tier 3: Query USDA API and store results
      console.log(
        `🔍 Ingredient "${ingredientName}" not found in database, querying USDA...`
      );

      const usdaResult = await findBestUSDAMatch(normalizedName);
      if (!usdaResult) {
        console.log(`❌ No USDA match found for "${ingredientName}"`);
        return null;
      }

      // Store the USDA result in database for future use
      const storedIngredient = await storeIngredientNutrition(
        normalizedName,
        {
          fdcId: usdaResult.food.fdcId,
          description: usdaResult.food.description,
          dataType: usdaResult.food.dataType || "unknown",
          nutrients:
            usdaResult.food.foodNutrients?.map((nutrient) => ({
              nutrientId: nutrient.nutrientId,
              nutrientName: nutrient.nutrientName || "",
              value: nutrient.value || 0,
              unitName: nutrient.unitName || "",
            })) || [],
          category:
            typeof usdaResult.food.foodCategory === "object"
              ? (usdaResult.food.foodCategory as { description?: string })
                  ?.description || "Unknown"
              : usdaResult.food.foodCategory || "Unknown",
        },
        [
          ingredientName.toLowerCase(),
          usdaResult.food.description.toLowerCase(),
        ]
      );

      if (storedIngredient) {
        const nutritionData: IngredientNutritionData = {
          ingredientName,
          nutrients: convertDatabaseToNutrientInfo(storedIngredient),
          matchConfidence: this.calculateUSDAMatchConfidence(
            ingredientName,
            usdaResult.food.description
          ),
          source: "usda",
        };

        // Cache in memory
        this.memoryCache.set(cacheKey, nutritionData);

        console.log(
          `✅ Stored nutrition data for "${ingredientName}" from USDA`
        );
        return nutritionData;
      }

      console.warn(`⚠️ Failed to store USDA data for "${ingredientName}"`);
      return null;
    } catch (error) {
      console.error(
        `❌ Error getting nutrition for "${ingredientName}":`,
        error
      );
      return null;
    }
  }

  /**
   * Get multiple ingredients efficiently with batch processing
   */
  async getMultipleIngredients(
    ingredientNames: string[]
  ): Promise<Array<IngredientNutritionData | null>> {
    // Process in parallel for better performance
    const results = await Promise.allSettled(
      ingredientNames.map((name) => this.getIngredientNutrition(name))
    );

    return results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      } else {
        console.warn("Failed to get nutrition for ingredient:", result.reason);
        return null;
      }
    });
  }

  /**
   * Calculate confidence score for USDA matches
   */
  private calculateUSDAMatchConfidence(
    searchTerm: string,
    usdaDescription: string
  ): number {
    const normalizedSearch = searchTerm.toLowerCase().replace(/[^a-z\s]/g, " ");
    const normalizedDescription = usdaDescription
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ");

    // Exact match
    if (normalizedSearch === normalizedDescription) return 1.0;

    // Contains match
    if (normalizedDescription.includes(normalizedSearch)) return 0.9;

    // Word overlap
    const searchWords = normalizedSearch
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const descWords = normalizedDescription
      .split(/\s+/)
      .filter((w) => w.length > 2);

    if (searchWords.length === 0) return 0.5;

    const matches = searchWords.filter((word) =>
      descWords.some(
        (descWord) => descWord.includes(word) || word.includes(descWord)
      )
    );

    const overlapRatio = matches.length / searchWords.length;

    if (overlapRatio >= 0.7) return 0.8;
    if (overlapRatio >= 0.5) return 0.7;
    if (overlapRatio >= 0.3) return 0.6;

    return 0.5; // Minimum confidence for USDA matches
  }

  /**
   * Normalize ingredient name for consistent matching
   */
  private normalizeIngredientName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, " ") // Replace non-word chars with spaces
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .replace(
        /(^|\s)(raw|fresh|frozen|dried|cooked|boiled|steamed|grilled|baked)(\s|$)/g,
        " "
      )
      .trim();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      memory: this.memoryCache.getStats(),
      // Database stats would need to be implemented in ingredientNutritionDB
    };
  }

  /**
   * Clear memory cache (database cache remains persistent)
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

// Singleton instance
let nutritionDataProvider: EnhancedNutritionDataProvider;

export function getNutritionDataProvider(): EnhancedNutritionDataProvider {
  if (!nutritionDataProvider) {
    nutritionDataProvider = new EnhancedNutritionDataProvider();
  }
  return nutritionDataProvider;
}

// Export the default instance
export default getNutritionDataProvider();
