/**
 * USDA FoodData Central API Service
 * Provides integration with USDA's nutrition database as a fallback data source
 *
 * This service is part of the hybrid nutrition analysis approach:
 * 1. First check local database for ingredient data
 * 2. If not found, query USDA FoodData Central
 * 3. Cache results for future use
 */

import { z } from "zod";
import { IngredientNutrient, Nutrient } from "@/generated/prisma";
import { NUTRIENT_IDS } from "@/utils/nutrientDefinitions";

// Configuration
const USDA_API_BASE = "https://api.nal.usda.gov/fdc/v1";
const DEFAULT_PAGE_SIZE = 25;
const REQUEST_TIMEOUT = 10000; // 10 seconds
const RATE_LIMIT_DELAY = 100; // 100ms between requests

// type NutrientNumber = '1008' | '1003' | '1004' | '1005' | '1079';
// const CORE_NUTRIENTS: NutrientNumber[] = ['1008','1003','1004','1005','1079'];

// Rate limiting
let lastRequestTime = 0;

// Validation schemas for USDA API responses
const USDANutrientSchema = z.object({
  nutrientId: z.union([z.number(), z.string()]).optional(),
  nutrientName: z.string().optional(),
  nutrientNumber: z.union([z.number(), z.string()]).optional(),
  unitName: z.string().optional(),
  value: z.number().optional(),
  amount: z.number().optional(),
  nutrient: z
    .object({
      id: z.union([z.number(), z.string()]).optional(),
      name: z.string().optional(),
      unitName: z.string().optional(),
      nutrientCategory: z.string().optional(),
      number: z.string().optional(),
      rank: z.number().optional(),
    })
    .optional(),
});

const USDAFoodItemSchema = z.object({
  fdcId: z.number(),
  description: z.string(),
  dataType: z.string().optional(),
  foodNutrients: z.array(USDANutrientSchema).optional(),
  brandOwner: z.string().optional(),
  ingredients: z.string().optional(),
  servingSize: z.number().optional(),
  servingSizeUnit: z.string().optional(),
  ndbNumber: z.union([z.string(), z.number()]).optional(),
  foodCategory: z
    .union([
      z.string(),
      z.object({
        description: z.string(),
      }),
    ])
    .optional(),
  foodClass: z.string().optional(),
  publicationDate: z.string().optional(),
});

const USDASearchResultSchema = z.object({
  foods: z.array(USDAFoodItemSchema),
  totalHits: z.number(),
  currentPage: z.number(),
  totalPages: z.number(),
});

export type USDANutrient = z.infer<typeof USDANutrientSchema>;
export type USDAFoodItem = z.infer<typeof USDAFoodItemSchema>;
export type USDASearchResult = z.infer<typeof USDASearchResultSchema>;

// Internal nutrient format for better type safety
export interface NutrientData {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category?: string;
  confidence: number;
}

// Rate limiter helper
async function enforceRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    await new Promise((resolve) =>
      setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();
}

// Fetch with timeout helper
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("USDA API request timeout");
    }
    throw error;
  }
}

/**
 * Search USDA FoodData Central for foods
 * Implements rate limiting and error handling
 */
export async function searchUSDAFoods(
  query: string,
  options: {
    pageSize?: number;
    pageNumber?: number;
    dataTypes?: string[];
  } = {}
): Promise<USDASearchResult> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.warn(
      "USDA API key not configured - falling back to local data only"
    );
    return { foods: [], totalHits: 0, currentPage: 1, totalPages: 0 };
  }

  await enforceRateLimit();

  const url = new URL(`${USDA_API_BASE}/foods/search`);
  url.searchParams.append("api_key", apiKey);
  url.searchParams.append("query", query);
  url.searchParams.append(
    "pageSize",
    (options.pageSize || DEFAULT_PAGE_SIZE).toString()
  );

  if (options.pageNumber) {
    url.searchParams.append("pageNumber", options.pageNumber.toString());
  }

  // Default to Foundation and SR Legacy for better quality data
  const dataTypes = options.dataTypes || [
    "Foundation",
    "SR Legacy",
    "Survey (FNDDS)",
  ];
  dataTypes.forEach((type) => url.searchParams.append("dataType", type));

  try {
    const response = await fetchWithTimeout(url.toString());

    if (!response.ok) {
      console.error(
        `USDA API error: ${response.status} ${response.statusText}`
      );
      return { foods: [], totalHits: 0, currentPage: 1, totalPages: 0 };
    }

    const data = await response.json();
    return USDASearchResultSchema.parse(data);
  } catch (error) {
    console.error("Failed to search USDA foods:", error);
    return { foods: [], totalHits: 0, currentPage: 1, totalPages: 0 };
  }
}

/**
 * Get detailed food data by FDC ID
 * Includes full nutrient profile
 * Optimized to request only the 4 most important macronutrients
 */
export async function getUSDAFoodById(
  fdcId: number,
  includeNutrients = true
): Promise<USDAFoodItem | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.warn("USDA API key not configured");
    return null;
  }

  await enforceRateLimit();

  const url = new URL(`${USDA_API_BASE}/food/${fdcId}`);
  url.searchParams.append("api_key", apiKey);

  if (includeNutrients) {
    url.searchParams.append("format", "full");

    // Request only the 4 most important macronutrients for better performance
    // Energy (1008), Protein (1003), Fat (1004), Carbs (1005)
    const coreMacros = [
      NUTRIENT_IDS.ENERGY, // 1008 - Energy
      NUTRIENT_IDS.PROTEIN, // 1003 - Protein
      NUTRIENT_IDS.FAT, // 1004 - Total Fat
      NUTRIENT_IDS.CARBS, // 1005 - Carbohydrates
    ];
    url.searchParams.append("nutrients", coreMacros.join(","));
  } else {
    url.searchParams.append("format", "abridged");
  }

  try {
    const response = await fetchWithTimeout(url.toString());

    if (!response.ok) {
      console.error(`USDA API error for food ${fdcId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log("data", data);

    const foodDetail = USDAFoodItemSchema.parse(data);

    // Warn if USDA data is incomplete (helpful for debugging)
    if (
      includeNutrients &&
      foodDetail.foodNutrients &&
      foodDetail.foodNutrients.length < 5
    ) {
      console.warn(
        `⚠️ USDA food ${fdcId} (${foodDetail.description}) has incomplete nutrient data (${foodDetail.foodNutrients.length} nutrients)`
      );
    }

    return foodDetail;
  } catch (error) {
    console.error(`Failed to get USDA food ${fdcId}:`, error);
    return null;
  }
}

/**
 * Legacy function - maintained for backward compatibility
 * Fetches nutrient data for an ingredient from the USDA FoodData Central API.
 */
export async function fetchUSDAIngredientNutrition(
  ingredientId: string,
  ingredientName: string
): Promise<(IngredientNutrient & { nutrient: Nutrient })[]> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.warn("USDA_API_KEY not configured");
    return [];
  }

  try {
    // Search for the ingredient
    const searchResult = await searchUSDAFoods(ingredientName, {
      pageSize: 1,
      dataTypes: ["Survey (FNDDS)", "Foundation", "SR Legacy", "Branded"],
    });

    if (searchResult.foods.length === 0) {
      return [];
    }

    const foodId = searchResult.foods[0].fdcId;

    // Get detailed nutrient data
    const foodDetail = await getUSDAFoodById(foodId, true);
    if (!foodDetail || !foodDetail.foodNutrients) {
      return [];
    }

    console.log("foodDetail", foodDetail.foodNutrients);

    // Convert to our internal format
    return convertUSDAToIngredientNutrients(
      ingredientId,
      foodDetail.foodNutrients
    );
  } catch (error) {
    console.warn("USDA nutrition lookup error", error);
    return [];
  }
}

/**
 * Convert USDA nutrients to our internal IngredientNutrient format
 */
export function convertUSDAToIngredientNutrients(
  ingredientId: string,
  usdaNutrients: USDANutrient[]
): (IngredientNutrient & { nutrient: Nutrient })[] {
  return usdaNutrients
    .filter((n) => {
      // Filter out nutrients without valid data
      const hasAmount = (n.amount ?? n.value ?? 0) > 0;
      const hasName = !!(n.nutrient?.name || n.nutrientName);
      return hasAmount && hasName;
    })
    .map((n: USDANutrient) => {
      // Extract nutrient ID (prefer nutrient.id, fallback to other fields)
      const rawNutrientId =
        n.nutrient?.id ?? n.nutrientId ?? n.nutrientNumber ?? null;
      const nutrientName = n.nutrient?.name ?? n.nutrientName ?? "Unknown";

      // Create a stable nutrient ID
      const safeNutrientId = rawNutrientId
        ? `usda:${String(rawNutrientId)}`
        : `usda:${nutrientName.toLowerCase().replace(/\s+/g, "_")}`;

      const ingredientNutrientId = `${ingredientId}:${safeNutrientId}`;

      // Extract amount and unit
      const amount = n.amount ?? n.value ?? 0;
      const unit = (n.nutrient?.unitName ?? n.unitName ?? "g").toLowerCase();

      return {
        id: ingredientNutrientId,
        ingredientId,
        nutrientId: safeNutrientId,
        value: amount,
        confidence: 0.8,
        source: "usda",
        createdAt: new Date(),
        updatedAt: new Date(),
        nutrient: {
          id: safeNutrientId,
          name: nutrientName,
          unit,
          nutrientCategory:
            n.nutrient?.nutrientCategory || categorizeNutrient(nutrientName),
          dailyValue: getDailyValue(nutrientName, amount, unit),
          dailyValueUnit: unit,
          displayOrder: getDisplayOrder(nutrientName),
          createdAt: new Date(),
          updatedAt: new Date(),
          usdaNutrientId: rawNutrientId ? Number(rawNutrientId) : null,
        },
      } as IngredientNutrient & { nutrient: Nutrient };
    });
}

/**
 * Categorize nutrients based on name
 */
function categorizeNutrient(name: string): string {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("protein")) return "Macronutrient";
  if (
    lowerName.includes("carbohydrate") ||
    lowerName.includes("fiber") ||
    lowerName.includes("sugar")
  )
    return "Macronutrient";
  if (lowerName.includes("fat") || lowerName.includes("fatty acid"))
    return "Macronutrient";
  if (lowerName.includes("vitamin")) return "Vitamin";
  if (
    lowerName.includes("calcium") ||
    lowerName.includes("iron") ||
    lowerName.includes("sodium") ||
    lowerName.includes("potassium") ||
    lowerName.includes("magnesium") ||
    lowerName.includes("zinc")
  )
    return "Mineral";
  if (lowerName.includes("energy") || lowerName.includes("calorie"))
    return "Energy";

  return "Other";
}

/**
 * Get daily value percentage for common nutrients
 */
function getDailyValue(
  name: string,
  amount: number,
  unit: string
): number | null {
  const lowerName = name.toLowerCase();

  // Daily values based on 2000 calorie diet (FDA standards)
  const dailyValues: Record<string, { value: number; unit: string }> = {
    energy: { value: 2000, unit: "kcal" },
    protein: { value: 50, unit: "g" },
    "total fat": { value: 65, unit: "g" },
    "saturated fat": { value: 20, unit: "g" },
    carbohydrate: { value: 300, unit: "g" },
    fiber: { value: 25, unit: "g" },
    sugar: { value: 50, unit: "g" },
    sodium: { value: 2300, unit: "mg" },
    calcium: { value: 1000, unit: "mg" },
    iron: { value: 18, unit: "mg" },
    potassium: { value: 3500, unit: "mg" },
    "vitamin a": { value: 900, unit: "mcg" },
    "vitamin c": { value: 90, unit: "mg" },
    "vitamin d": { value: 20, unit: "mcg" },
  };

  for (const [nutrient, dv] of Object.entries(dailyValues)) {
    if (
      lowerName.includes(nutrient) &&
      unit.toLowerCase() === dv.unit.toLowerCase()
    ) {
      return Math.round((amount / dv.value) * 100);
    }
  }

  return null;
}

/**
 * Get display order for nutrients (for UI presentation)
 */
function getDisplayOrder(name: string): number {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("energy") || lowerName.includes("calorie")) return 1;
  if (lowerName.includes("protein")) return 2;
  if (lowerName.includes("total fat")) return 3;
  if (lowerName.includes("saturated fat")) return 4;
  if (lowerName.includes("carbohydrate")) return 5;
  if (lowerName.includes("fiber")) return 6;
  if (lowerName.includes("sugar")) return 7;
  if (lowerName.includes("sodium")) return 8;

  return 99; // Other nutrients at the end
}

/**
 * Find best matching food from USDA for an ingredient name
 * Returns the most relevant result based on search ranking
 */

/* ************************************************************** */
/* ************************************************************** */
/* ************************************************************** */
// Found issue with route. It is not using the getUSDAFoodById function
/* ************************************************************** */
/* ************************************************************** */
/* ************************************************************** */

export async function findBestUSDAMatch(
  ingredientName: string,
  options: {
    preferGeneric?: boolean;
    maxResults?: number;
  } = {}
): Promise<{ food: USDAFoodItem; confidence: number } | null> {
  const searchResults = await searchUSDAFoods(ingredientName, {
    pageSize: options.maxResults || 5,
    dataTypes: options.preferGeneric
      ? ["Foundation", "SR Legacy", "Survey (FNDDS)"]
      : undefined,
  });

  if (searchResults.foods.length === 0) {
    return null;
  }

  // Use first result (USDA ranks by relevance)
  const bestMatch = searchResults.foods[0];

  // Calculate confidence based on name similarity
  const confidence = calculateConfidence(ingredientName, bestMatch.description);

  return { food: bestMatch, confidence };
}

/**
 * Calculate confidence score for ingredient match
 */
function calculateConfidence(
  searchTerm: string,
  resultDescription: string
): number {
  const searchLower = searchTerm.toLowerCase();
  const resultLower = resultDescription.toLowerCase();

  // Exact match
  if (searchLower === resultLower) return 100;

  // Contains exact search term
  if (resultLower.includes(searchLower)) return 90;

  // All search words present
  const searchWords = searchLower.split(/\s+/);
  const allWordsPresent = searchWords.every((word) =>
    resultLower.includes(word)
  );
  if (allWordsPresent) return 80;

  // Some search words present
  const someWordsPresent = searchWords.some((word) =>
    resultLower.includes(word)
  );
  if (someWordsPresent) return 60;

  // Default low confidence
  return 40;
}
