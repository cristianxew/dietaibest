/**
 * Nutrition Data Provider
 *
 * Provides a modular interface for nutrient data lookups.
 * Abstracts the data source (local database, USDA API, or cached data)
 * to make the system more maintainable and testable.
 */

import { findBestUSDAMatch, type USDANutrient } from "./usda";
import { getNutritionCache } from "./nutritionCache";

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

// Daily values for common nutrients (based on 2000 calorie diet)
export const DAILY_VALUES: Record<string, { amount: number; unit: string }> = {
  [NUTRIENT_IDS.ENERGY]: { amount: 2000, unit: "kcal" },
  [NUTRIENT_IDS.PROTEIN]: { amount: 50, unit: "g" },
  [NUTRIENT_IDS.FAT]: { amount: 65, unit: "g" },
  [NUTRIENT_IDS.CARBS]: { amount: 300, unit: "g" },
  [NUTRIENT_IDS.FIBER]: { amount: 25, unit: "g" },
  [NUTRIENT_IDS.SUGAR]: { amount: 50, unit: "g" },
  [NUTRIENT_IDS.SODIUM]: { amount: 2300, unit: "mg" },
  [NUTRIENT_IDS.SATURATED_FAT]: { amount: 20, unit: "g" },
  [NUTRIENT_IDS.CHOLESTEROL]: { amount: 300, unit: "mg" },
  [NUTRIENT_IDS.CALCIUM]: { amount: 1000, unit: "mg" },
  [NUTRIENT_IDS.IRON]: { amount: 18, unit: "mg" },
  [NUTRIENT_IDS.POTASSIUM]: { amount: 3500, unit: "mg" },
  [NUTRIENT_IDS.VITAMIN_A]: { amount: 900, unit: "mcg" },
  [NUTRIENT_IDS.VITAMIN_C]: { amount: 90, unit: "mg" },
  [NUTRIENT_IDS.VITAMIN_D]: { amount: 20, unit: "mcg" },
};

/**
 * Nutrition Data Provider class
 * Implements the data access pattern for nutrient lookups
 */
export class NutritionDataProvider {
  private cache = getNutritionCache();
  private localDatabase: Map<string, IngredientNutritionData>;

  constructor() {
    // Initialize with some common ingredients for demo
    // In production, this would connect to a real database
    this.localDatabase = new Map();
    this.initializeLocalData();
  }

  /**
   * Get nutrition data for an ingredient
   * Tries cache -> local -> USDA in that order
   */
  async getNutritionData(
    ingredientName: string,
    options: {
      preferUSDA?: boolean;
      skipCache?: boolean;
    } = {}
  ): Promise<IngredientNutritionData | null> {
    const normalizedName = this.normalizeIngredientName(ingredientName);

    // Check cache first (unless skipped)
    if (!options.skipCache) {
      const cached = this.cache.get(
        `nutrition:${normalizedName}`
      ) as IngredientNutritionData | null;
      if (cached) {
        return { ...cached, source: "cache" };
      }
    }

    // Try USDA first if preferred
    if (options.preferUSDA) {
      const usdaData = await this.fetchUSDAData(ingredientName);
      if (usdaData) {
        this.cache.set(`nutrition:${normalizedName}`, usdaData);
        return usdaData;
      }
    }

    // Try local database
    const localData = this.getLocalData(normalizedName);
    if (localData) {
      this.cache.set(`nutrition:${normalizedName}`, localData);
      return localData;
    }

    // Fallback to USDA if not already tried
    if (!options.preferUSDA) {
      const usdaData = await this.fetchUSDAData(ingredientName);
      if (usdaData) {
        this.cache.set(`nutrition:${normalizedName}`, usdaData);
        return usdaData;
      }
    }

    return null;
  }

  /**
   * Get nutrition data from local database
   */
  private getLocalData(ingredientName: string): IngredientNutritionData | null {
    // Try exact match
    const data = this.localDatabase.get(ingredientName);
    if (data) {
      return { ...data, source: "local" as const };
    }

    // Try fuzzy match
    for (const [name, nutritionData] of this.localDatabase.entries()) {
      if (this.isSimilarIngredient(ingredientName, name)) {
        return {
          ...nutritionData,
          source: "local" as const,
          matchConfidence: 0.8, // Lower confidence for fuzzy match
        };
      }
    }

    return null;
  }

  /**
   * Fetch nutrition data from USDA
   */
  private async fetchUSDAData(
    ingredientName: string
  ): Promise<IngredientNutritionData | null> {
    try {
      const match = await findBestUSDAMatch(ingredientName, {
        preferGeneric: true,
        maxResults: 3,
      });

      if (!match || match.confidence < 40) {
        return null;
      }

      const nutrients: NutrientInfo[] = [];

      if (match.food.foodNutrients) {
        for (const nutrient of match.food.foodNutrients) {
          const info = this.convertUSDANutrient(nutrient as USDANutrient);
          if (info) {
            nutrients.push(info);
          }
        }
      }

      return {
        ingredientName: match.food.description,
        nutrients,
        matchConfidence: match.confidence / 100,
        source: "usda",
      };
    } catch (error) {
      console.error("Error fetching USDA data:", error);
      return null;
    }
  }

  /**
   * Convert USDA nutrient to our format
   */
  private convertUSDANutrient(nutrient: USDANutrient): NutrientInfo | null {
    const id = nutrient.nutrient?.id || nutrient.nutrientId;
    const name = nutrient.nutrient?.name || nutrient.nutrientName;
    const value = nutrient.amount || nutrient.value || 0;
    const unit = nutrient.nutrient?.unitName || nutrient.unitName || "g";

    if (!id || !name || value === 0) {
      return null;
    }

    const nutrientId = `usda:${id}`;
    const dailyValue = this.calculateDailyValue(nutrientId, value, unit);

    return {
      id: nutrientId,
      name,
      value,
      unit: unit.toLowerCase(),
      category: this.categorizeNutrient(name),
      confidence: 0.9, // High confidence for USDA data
      dailyValue,
      source: "usda",
    };
  }

  /**
   * Calculate daily value percentage
   */
  private calculateDailyValue(
    nutrientId: string,
    value: number,
    unit: string
  ): number | undefined {
    const dv = DAILY_VALUES[nutrientId];
    if (!dv || dv.unit.toLowerCase() !== unit.toLowerCase()) {
      return undefined;
    }

    return Math.round((value / dv.amount) * 100);
  }

  /**
   * Categorize nutrient by name
   */
  private categorizeNutrient(name: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes("energy") || lowerName.includes("calorie"))
      return "Energy";
    if (lowerName.includes("protein")) return "Macronutrient";
    if (lowerName.includes("fat")) return "Macronutrient";
    if (
      lowerName.includes("carbohydrate") ||
      lowerName.includes("sugar") ||
      lowerName.includes("fiber")
    )
      return "Macronutrient";
    if (lowerName.includes("vitamin")) return "Vitamin";
    if (
      lowerName.includes("calcium") ||
      lowerName.includes("iron") ||
      lowerName.includes("sodium") ||
      lowerName.includes("potassium")
    )
      return "Mineral";

    return "Other";
  }

  /**
   * Normalize ingredient name for matching
   */
  private normalizeIngredientName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, "") // Remove special characters
      .replace(/\s+/g, " "); // Normalize whitespace
  }

  /**
   * Check if two ingredient names are similar
   */
  private isSimilarIngredient(name1: string, name2: string): boolean {
    const words1 = name1.split(" ");
    const words2 = name2.split(" ");

    // Check if all words from shorter name are in longer name
    const shorter = words1.length < words2.length ? words1 : words2;
    const longer = words1.length >= words2.length ? words1 : words2;

    return shorter.every((word) =>
      longer.some((w) => w.includes(word) || word.includes(w))
    );
  }

  /**
   * Initialize local database with common ingredients
   * In production, this would load from a real database
   */
  private initializeLocalData(): void {
    // Add some common ingredients with nutrition data
    this.localDatabase.set("chicken breast", {
      ingredientName: "Chicken Breast",
      nutrients: [
        {
          id: NUTRIENT_IDS.ENERGY,
          name: "Energy",
          value: 165,
          unit: "kcal",
          category: "Energy",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.PROTEIN,
          name: "Protein",
          value: 31,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.FAT,
          name: "Total Fat",
          value: 3.6,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.CARBS,
          name: "Carbohydrates",
          value: 0,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
      ],
      matchConfidence: 1,
      source: "local",
    });

    this.localDatabase.set("white rice", {
      ingredientName: "White Rice",
      nutrients: [
        {
          id: NUTRIENT_IDS.ENERGY,
          name: "Energy",
          value: 130,
          unit: "kcal",
          category: "Energy",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.PROTEIN,
          name: "Protein",
          value: 2.7,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.FAT,
          name: "Total Fat",
          value: 0.3,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.CARBS,
          name: "Carbohydrates",
          value: 28,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.FIBER,
          name: "Fiber",
          value: 0.4,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
      ],
      matchConfidence: 1,
      source: "local",
    });

    this.localDatabase.set("olive oil", {
      ingredientName: "Olive Oil",
      nutrients: [
        {
          id: NUTRIENT_IDS.ENERGY,
          name: "Energy",
          value: 884,
          unit: "kcal",
          category: "Energy",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.FAT,
          name: "Total Fat",
          value: 100,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.SATURATED_FAT,
          name: "Saturated Fat",
          value: 14,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
      ],
      matchConfidence: 1,
      source: "local",
    });

    this.localDatabase.set("broccoli", {
      ingredientName: "Broccoli",
      nutrients: [
        {
          id: NUTRIENT_IDS.ENERGY,
          name: "Energy",
          value: 34,
          unit: "kcal",
          category: "Energy",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.PROTEIN,
          name: "Protein",
          value: 2.8,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.CARBS,
          name: "Carbohydrates",
          value: 6.6,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.FIBER,
          name: "Fiber",
          value: 2.6,
          unit: "g",
          category: "Macronutrient",
          confidence: 1,
          source: "local",
        },
        {
          id: NUTRIENT_IDS.VITAMIN_C,
          name: "Vitamin C",
          value: 89,
          unit: "mg",
          category: "Vitamin",
          confidence: 1,
          source: "local",
        },
      ],
      matchConfidence: 1,
      source: "local",
    });
  }

  /**
   * Batch get nutrition data for multiple ingredients
   */
  async batchGetNutritionData(
    ingredientNames: string[],
    options: {
      preferUSDA?: boolean;
      skipCache?: boolean;
    } = {}
  ): Promise<Map<string, IngredientNutritionData | null>> {
    const results = new Map<string, IngredientNutritionData | null>();

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < ingredientNames.length; i += BATCH_SIZE) {
      const batch = ingredientNames.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((name) => this.getNutritionData(name, options))
      );

      batch.forEach((name, index) => {
        results.set(name, batchResults[index]);
      });
    }

    return results;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// Singleton instance
let dataProviderInstance: NutritionDataProvider | null = null;

/**
 * Get or create the singleton data provider instance
 */
export function getNutritionDataProvider(): NutritionDataProvider {
  if (!dataProviderInstance) {
    dataProviderInstance = new NutritionDataProvider();
  }
  return dataProviderInstance;
}
