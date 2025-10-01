/**
 * Ingredient Nutrition Database Service
 *
 * Handles persistent storage and retrieval of ingredient nutritional data.
 * This service acts as the primary cache layer for the hybrid nutrition system.
 *
 * Flow:
 * 1. Check database for existing ingredient nutrition data
 * 2. If not found, service consumer should query USDA API
 * 3. Store USDA results in database for future use
 * 4. Return consistent nutrition data format
 */

import prisma from "@/lib/prisma";
import { createHash } from "crypto";
import type {
  Ingredient,
  Nutrient,
  IngredientNutrient,
} from "@/generated/prisma";

// Simple ingredient name normalization
function normalizeIngredientName(name: string): string {
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

// Re-export types from data provider for consistency
export type {
  NutrientInfo,
  IngredientNutritionData,
} from "./nutritionDataProvider";

interface DatabaseIngredientData extends Ingredient {
  nutrients: (IngredientNutrient & { nutrient: Nutrient })[];
}

export interface IngredientLookupResult {
  found: boolean;
  ingredient?: DatabaseIngredientData;
  searchTermUsed?: string;
  matchConfidence: number;
}

/**
 * Initialize default nutrients in the database if they don't exist
 */
export async function initializeNutrients(): Promise<void> {
  const defaultNutrients = [
    // Macronutrients
    {
      name: "Energy",
      category: "Macronutrients",
      unit: "kcal",
      usdaNutrientId: 208,
      dailyValue: 2000,
    },
    {
      name: "Protein",
      category: "Macronutrients",
      unit: "g",
      usdaNutrientId: 203,
      dailyValue: 50,
    },
    {
      name: "Total Fat",
      category: "Macronutrients",
      unit: "g",
      usdaNutrientId: 204,
      dailyValue: 65,
    },
    {
      name: "Carbohydrates",
      category: "Macronutrients",
      unit: "g",
      usdaNutrientId: 205,
      dailyValue: 300,
    },
    {
      name: "Dietary Fiber",
      category: "Macronutrients",
      unit: "g",
      usdaNutrientId: 291,
      dailyValue: 25,
    },
    {
      name: "Total Sugars",
      category: "Macronutrients",
      unit: "g",
      usdaNutrientId: 269,
    },

    // Minerals
    {
      name: "Sodium",
      category: "Minerals",
      unit: "mg",
      usdaNutrientId: 307,
      dailyValue: 2300,
    },
    {
      name: "Potassium",
      category: "Minerals",
      unit: "mg",
      usdaNutrientId: 306,
      dailyValue: 3500,
    },
    {
      name: "Calcium",
      category: "Minerals",
      unit: "mg",
      usdaNutrientId: 301,
      dailyValue: 1000,
    },
    {
      name: "Iron",
      category: "Minerals",
      unit: "mg",
      usdaNutrientId: 303,
      dailyValue: 18,
    },

    // Vitamins
    {
      name: "Vitamin C",
      category: "Vitamins",
      unit: "mg",
      usdaNutrientId: 401,
      dailyValue: 90,
    },
    {
      name: "Vitamin A",
      category: "Vitamins",
      unit: "µg",
      usdaNutrientId: 320,
      dailyValue: 900,
    },
    {
      name: "Vitamin D",
      category: "Vitamins",
      unit: "µg",
      usdaNutrientId: 328,
      dailyValue: 20,
    },

    // Fatty Acids
    {
      name: "Saturated Fat",
      category: "Fatty Acids",
      unit: "g",
      usdaNutrientId: 606,
      dailyValue: 20,
    },
    {
      name: "Trans Fat",
      category: "Fatty Acids",
      unit: "g",
      usdaNutrientId: 605,
    },
    {
      name: "Cholesterol",
      category: "Fatty Acids",
      unit: "mg",
      usdaNutrientId: 601,
      dailyValue: 300,
    },
  ];

  for (const nutrient of defaultNutrients) {
    try {
      await prisma.nutrient.upsert({
        where: { name: nutrient.name },
        update: {
          nutrientCategory: nutrient.category,
          unit: nutrient.unit,
          usdaNutrientId: nutrient.usdaNutrientId,
          dailyValue: nutrient.dailyValue,
        },
        create: {
          name: nutrient.name,
          nutrientCategory: nutrient.category,
          unit: nutrient.unit,
          usdaNutrientId: nutrient.usdaNutrientId,
          dailyValue: nutrient.dailyValue,
        },
      });
    } catch (error) {
      console.warn(`Failed to initialize nutrient ${nutrient.name}:`, error);
    }
  }
}

/**
 * Search for ingredient in database by name with fuzzy matching
 */
export async function findIngredientInDatabase(
  ingredientName: string
): Promise<IngredientLookupResult> {
  const normalizedName = normalizeIngredientName(ingredientName);

  try {
    // First, try exact match on normalized name
    let ingredient = await prisma.ingredient.findFirst({
      where: {
        OR: [
          { name: { equals: normalizedName, mode: "insensitive" } },
          { commonName: { equals: normalizedName, mode: "insensitive" } },
        ],
      },
      include: {
        nutrients: {
          include: {
            nutrient: true,
          },
        },
      },
    });

    if (ingredient) {
      return {
        found: true,
        ingredient,
        searchTermUsed: normalizedName,
        matchConfidence: 1.0,
      };
    }

    // Try fuzzy matching using search terms
    ingredient = await prisma.ingredient.findFirst({
      where: {
        searchTerms: {
          hasSome: [normalizedName.toLowerCase()],
        },
      },
      include: {
        nutrients: {
          include: {
            nutrient: true,
          },
        },
      },
    });

    if (ingredient) {
      return {
        found: true,
        ingredient,
        searchTermUsed: normalizedName,
        matchConfidence: 0.8,
      };
    }

    // Try partial matching (contains)
    ingredient = await prisma.ingredient.findFirst({
      where: {
        OR: [
          { name: { contains: normalizedName, mode: "insensitive" } },
          { commonName: { contains: normalizedName, mode: "insensitive" } },
        ],
      },
      include: {
        nutrients: {
          include: {
            nutrient: true,
          },
        },
      },
    });

    if (ingredient) {
      return {
        found: true,
        ingredient,
        searchTermUsed: normalizedName,
        matchConfidence: 0.6,
      };
    }

    return {
      found: false,
      matchConfidence: 0,
    };
  } catch (error) {
    console.error("Database ingredient lookup failed:", error);
    return {
      found: false,
      matchConfidence: 0,
    };
  }
}

/**
 * Store ingredient and its nutritional data from USDA API response
 */
export async function storeIngredientNutrition(
  ingredientName: string,
  usdaData: {
    fdcId: number;
    description: string;
    dataType: string;
    nutrients: Array<{
      nutrientId?: number | string;
      nutrientName?: string;
      value: number;
      unitName: string;
    }>;
    category?: string;
  },
  searchTerms: string[] = []
): Promise<DatabaseIngredientData | null> {
  const normalizedName = normalizeIngredientName(ingredientName);

  try {
    // First ensure nutrients exist in database
    await initializeNutrients();

    // Create or update ingredient
    const ingredient = await prisma.ingredient.upsert({
      where: { name: normalizedName },
      update: {
        commonName: usdaData.description,
        category: usdaData.category,
        usdaFdcId: usdaData.fdcId,
        usdaDataType: usdaData.dataType,
        searchTerms: [
          ...searchTerms,
          normalizedName.toLowerCase(),
          usdaData.description.toLowerCase(),
        ],
        updatedAt: new Date(),
      },
      create: {
        name: normalizedName,
        commonName: usdaData.description,
        category: usdaData.category,
        usdaFdcId: usdaData.fdcId,
        usdaDataType: usdaData.dataType,
        searchTerms: [
          ...searchTerms,
          normalizedName.toLowerCase(),
          usdaData.description.toLowerCase(),
        ],
      },
    });

    // Store nutritional data
    for (const nutrientData of usdaData.nutrients) {
      try {
        // Find corresponding nutrient in database
        const nutrient = await prisma.nutrient.findFirst({
          where: {
            OR: [
              { usdaNutrientId: Number(nutrientData.nutrientId) },
              {
                name: {
                  equals: nutrientData.nutrientName || "",
                  mode: "insensitive",
                },
              },
            ],
          },
        });

        if (nutrient && nutrientData.value > 0) {
          await prisma.ingredientNutrient.upsert({
            where: {
              ingredientId_nutrientId: {
                ingredientId: ingredient.id,
                nutrientId: nutrient.id,
              },
            },
            update: {
              value: nutrientData.value,
              source: "usda",
              confidence: 1.0,
              updatedAt: new Date(),
            },
            create: {
              ingredientId: ingredient.id,
              nutrientId: nutrient.id,
              value: nutrientData.value,
              source: "usda",
              confidence: 1.0,
            },
          });
        }
      } catch (nutrientError) {
        console.warn(
          `Failed to store nutrient data for ${nutrientData.nutrientName}:`,
          nutrientError
        );
      }
    }

    // Return the complete ingredient with nutrients
    const completeIngredient = await prisma.ingredient.findUnique({
      where: { id: ingredient.id },
      include: {
        nutrients: {
          include: {
            nutrient: true,
          },
        },
      },
    });

    return completeIngredient;
  } catch (error) {
    console.error("Failed to store ingredient nutrition data:", error);
    return null;
  }
}

/**
 * Convert database ingredient data to our standard format
 */
export function convertDatabaseToNutrientInfo(
  dbIngredient: DatabaseIngredientData
): Array<import("./nutritionDataProvider").NutrientInfo> {
  return dbIngredient.nutrients.map((ingNutrient) => ({
    id: ingNutrient.nutrient.id,
    name: ingNutrient.nutrient.name,
    value: ingNutrient.value,
    unit: ingNutrient.nutrient.unit,
    category: ingNutrient.nutrient.nutrientCategory,
    confidence: ingNutrient.confidence,
    dailyValue: ingNutrient.nutrient.dailyValue || undefined,
    source: ingNutrient.source as "local" | "usda" | "cache" | "custom",
  }));
}

/**
 * Cache nutrition calculation results in database
 */
export async function cacheNutritionCalculation(
  ingredients: Array<{ name: string; amount: number; unit: string }>,
  servings: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nutritionData: any,
  sources: { local: number; usda: number; cached: number }
): Promise<void> {
  const cacheKey = createHash("sha256")
    .update(JSON.stringify({ ingredients, servings }))
    .digest("hex");

  try {
    await prisma.nutritionCache.upsert({
      where: { cacheKey },
      update: {
        nutritionData,
        servings,
        confidence: nutritionData.overallConfidence || 0,
        sources,
        updatedAt: new Date(),
      },
      create: {
        cacheKey,
        nutritionData,
        servings,
        confidence: nutritionData.overallConfidence || 0,
        sources,
      },
    });
  } catch (error) {
    console.warn("Failed to cache nutrition calculation:", error);
  }
}

/**
 * Retrieve cached nutrition calculation
 */
export async function getCachedNutritionCalculation(
  ingredients: Array<{ name: string; amount: number; unit: string }>,
  servings: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const cacheKey = createHash("sha256")
    .update(JSON.stringify({ ingredients, servings }))
    .digest("hex");

  try {
    // Only return cache entries from the last 7 days
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const cached = await prisma.nutritionCache.findUnique({
      where: {
        cacheKey,
        updatedAt: { gte: oneWeekAgo },
      },
    });

    return cached?.nutritionData || null;
  } catch (error) {
    console.warn("Failed to retrieve cached nutrition calculation:", error);
    return null;
  }
}

/**
 * Clean up old cache entries (should be run periodically)
 */
export async function cleanupOldNutritionCache(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    await prisma.nutritionCache.deleteMany({
      where: {
        updatedAt: { lt: thirtyDaysAgo },
      },
    });
  } catch (error) {
    console.warn("Failed to cleanup old nutrition cache:", error);
  }
}
