/**
 * Edamam Nutritional Analysis Service
 *
 * High-level service that integrates:
 * - Edamam API client
 * - ETag-based caching for cost control
 * - Database persistence (fingerprints, ETags, cached macros)
 * - Synonym translation layer
 * - Error handling and fallbacks
 */

import prisma from "@/lib/prisma";
import {
  getEdamamClient,
  generateRecipeFingerprint,
  extractCacheableMacros,
  extractAllNutrients,
  extractLabels,
  type EdamamRecipeInput,
  type EdamamAnalyzedRecipe,
} from "./edamam";
import { processIngredientsForEdamam } from "./edamam-synonyms";

// ============================================================================
// Types
// ============================================================================

export interface RecipeNutritionInput {
  title: string;
  ingredients: string[]; // Raw ingredient lines
  servings?: number;
  url?: string;
  instructions?: string[];
}

export interface NutritionAnalysisResult {
  // Cacheable macros (per Edamam policy)
  macros: {
    calories: number;
    protein: number;
    fat: number;
    netCarbs: number;
  };

  // Full nutritional data (for immediate display only, not persistent storage)
  fullNutrients?: Record<
    string,
    { label: string; quantity: number; unit: string }
  >;

  // Labels
  dietLabels: string[];
  healthLabels: string[];
  cautions: string[];

  // Metadata
  servings: number;
  totalWeight?: number;

  // Source info
  fromCache: boolean;
  fingerprint: string;
  analyzedAt: Date;
}

export interface NutritionAnalysisError {
  error: string;
  code:
    | "INVALID_INPUT"
    | "API_ERROR"
    | "RATE_LIMIT"
    | "PARSE_ERROR"
    | "NETWORK_ERROR";
  retryable: boolean;
  details?: string;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Analyze recipe nutrition with full ETag caching and cost control
 */
export async function analyzeRecipeNutrition(
  recipe: RecipeNutritionInput,
  userId: string,
  options: {
    forceRefresh?: boolean; // Ignore cache and re-analyze
    locale?: "en" | "es" | "pl";
  } = {}
): Promise<NutritionAnalysisResult | NutritionAnalysisError> {
  try {
    // Validate input
    if (
      !recipe.title ||
      !recipe.ingredients ||
      recipe.ingredients.length === 0
    ) {
      return {
        error: "Recipe must have a title and at least one ingredient",
        code: "INVALID_INPUT",
        retryable: false,
      };
    }

    // Process ingredients through synonym translation layer
    const processedIngredients = processIngredientsForEdamam(
      recipe.ingredients
    );

    // Prepare Edamam API input
    const edamamInput: EdamamRecipeInput = {
      title: recipe.title,
      ingr: processedIngredients,
      yield: recipe.servings?.toString() || "1",
      url: recipe.url,
      prep: recipe.instructions,
    };

    // Generate deterministic fingerprint
    const fingerprint = generateRecipeFingerprint(edamamInput);

    // Check cache unless force refresh
    let cachedRecipe: any = null;
    let storedETag: string | undefined;

    if (!options.forceRefresh) {
      cachedRecipe = await prisma.edamamRecipeCache.findUnique({
        where: { fingerprint },
      });

      if (cachedRecipe) {
        storedETag = cachedRecipe.etag;
        console.info(
          `[EdamamService] Found cached recipe, fingerprint: ${fingerprint}, ETag: ${storedETag}`
        );
      }
    }

    // Call Edamam API
    const client = getEdamamClient();
    const apiResponse = await client.analyzeRecipe(edamamInput, {
      ifNoneMatch: storedETag,
      force: options.forceRefresh,
      kitchen: "home",
      locale: options.locale,
    });

    // Handle 304 Not Modified (use cached data)
    if (apiResponse.status === 304 && cachedRecipe) {
      const cachedResponse = cachedRecipe.fullResponse as EdamamAnalyzedRecipe;
      const servings = recipe.servings || 1;

      console.info(
        `[EdamamService] Using cached data - calories: ${
          cachedResponse.calories
        }, totalNutrients: ${
          Object.keys(cachedResponse.totalNutrients || {}).length
        } nutrients`
      );

      // Extract cacheable macros
      const macros = extractCacheableMacros(cachedResponse, servings);

      console.info(
        `[EdamamService] Extracted macros from cache - calories: ${macros.calories}, protein: ${macros.protein}, fat: ${macros.fat}, carbs: ${macros.netCarbs}`
      );

      // Extract labels
      const labels = extractLabels(cachedResponse);

      return {
        macros,
        fullNutrients: extractAllNutrients(cachedResponse),
        dietLabels: labels.dietLabels,
        healthLabels: labels.healthLabels,
        cautions: labels.cautions,
        servings,
        totalWeight: cachedResponse.totalWeight,
        fromCache: true,
        fingerprint,
        analyzedAt: cachedRecipe.lastAnalyzed,
      };
    }

    // Handle successful analysis (200 OK)
    if (apiResponse.status === 200 && apiResponse.data) {
      const analysisData = apiResponse.data;
      const servings = recipe.servings || analysisData.yield || 1;

      console.info(
        `[EdamamService] Fresh analysis - calories: ${
          analysisData.calories
        }, totalNutrients keys: ${Object.keys(analysisData.totalNutrients || {})
          .slice(0, 5)
          .join(", ")}`
      );

      // Store/update cache
      // const cacheRecord = await prisma.edamamRecipeCache.upsert({
      //   where: { fingerprint },
      //   update: {
      //     etag: apiResponse.etag || "",
      //     fullResponse: analysisData as any,
      //     lastAnalyzed: new Date(),
      //     analysisCount: {
      //       increment: 1,
      //     },
      //   },
      //   create: {
      //     fingerprint,
      //     etag: apiResponse.etag || "",
      //     recipeData: edamamInput as any,
      //     fullResponse: analysisData as any,
      //     lastAnalyzed: new Date(),
      //     analysisCount: 1,
      //   },
      // });

      // Extract cacheable macros
      const macros = extractCacheableMacros(analysisData, servings);

      // Extract labels
      const labels = extractLabels(analysisData);

      console.info(
        `[EdamamService] Recipe analyzed successfully, fingerprint: ${fingerprint}, calories: ${macros.calories}`
      );

      return {
        macros,
        fullNutrients: extractAllNutrients(analysisData),
        dietLabels: labels.dietLabels,
        healthLabels: labels.healthLabels,
        cautions: labels.cautions,
        servings,
        totalWeight: analysisData.totalWeight,
        fromCache: false,
        fingerprint,
        analyzedAt: new Date(),
      };
    }

    // Unexpected response
    return {
      error: `Unexpected API response: ${apiResponse.status}`,
      code: "API_ERROR",
      retryable: false,
      details: "Received unexpected status code from Edamam API",
    };
  } catch (error: any) {
    console.error("[EdamamService] Analysis failed:", error);

    // Categorize error
    if (error.status === 429) {
      return {
        error: "Rate limit exceeded. Please try again later.",
        code: "RATE_LIMIT",
        retryable: true,
      };
    }

    if (error.status === 422 || error.status === 555) {
      return {
        error: "Could not parse recipe or extract nutritional information",
        code: "PARSE_ERROR",
        retryable: false,
        details: error.message,
      };
    }

    if (error.status === 0 || !error.status) {
      return {
        error: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
        retryable: true,
      };
    }

    return {
      error: error.message || "Failed to analyze recipe nutrition",
      code: "API_ERROR",
      retryable: error.retryable || false,
      details: error.message,
    };
  }
}

/**
 * Get cached nutrition for a recipe (user-specific)
 * This is used when retrieving already-saved recipes
 */
export async function getCachedRecipeNutrition(
  userId: string,
  recipeId: string
): Promise<NutritionAnalysisResult | null> {
  try {
    const macroCache = await prisma.edamamUserMacroCache.findUnique({
      where: {
        userId_recipeId: {
          userId,
          recipeId,
        },
      },
    });

    if (!macroCache) {
      return null;
    }

    return {
      macros: {
        calories: macroCache.calories,
        protein: macroCache.protein,
        fat: macroCache.fat,
        netCarbs: macroCache.netCarbs,
      },
      dietLabels: [],
      healthLabels: [],
      cautions: [],
      servings: macroCache.servings,
      fromCache: true,
      fingerprint: "", // Not stored in macro cache
      analyzedAt: macroCache.updatedAt,
    };
  } catch (error) {
    console.error("[EdamamService] Failed to get cached nutrition:", error);
    return null;
  }
}

/**
 * Save user macro cache for a recipe
 * This should be called AFTER the recipe is created in the database
 */
export async function saveUserMacroCache(
  userId: string,
  recipeId: string,
  macros: { calories: number; protein: number; fat: number; netCarbs: number },
  servings: number
): Promise<void> {
  try {
    await prisma.edamamUserMacroCache.upsert({
      where: {
        userId_recipeId: {
          userId,
          recipeId,
        },
      },
      update: {
        calories: macros.calories,
        protein: macros.protein,
        fat: macros.fat,
        netCarbs: macros.netCarbs,
        servings,
        updatedAt: new Date(),
      },
      create: {
        userId,
        recipeId,
        calories: macros.calories,
        protein: macros.protein,
        fat: macros.fat,
        netCarbs: macros.netCarbs,
        servings,
      },
    });

    console.info(
      `[EdamamService] Saved user macro cache for recipe: ${recipeId}`
    );
  } catch (error) {
    console.error("[EdamamService] Failed to save user macro cache:", error);
    // Non-critical error, don't throw
  }
}

/**
 * Bulk analyze recipes for a user (e.g., for meal planning)
 */
export async function analyzeBatchRecipes(
  recipes: RecipeNutritionInput[],
  userId: string,
  options: { locale?: "en" | "es" | "pl" } = {}
): Promise<(NutritionAnalysisResult | NutritionAnalysisError)[]> {
  const results: (NutritionAnalysisResult | NutritionAnalysisError)[] = [];

  // Process sequentially to respect rate limits
  for (const recipe of recipes) {
    const result = await analyzeRecipeNutrition(recipe, userId, options);
    results.push(result);
  }

  return results;
}

/**
 * Get nutrition summary for multiple recipes (e.g., daily totals)
 */
export async function getRecipeNutritionSummary(
  recipeIds: string[],
  userId: string
): Promise<{
  total: { calories: number; protein: number; fat: number; netCarbs: number };
  byRecipe: Array<{
    recipeId: string;
    macros: {
      calories: number;
      protein: number;
      fat: number;
      netCarbs: number;
    };
  }>;
}> {
  const macroCaches = await prisma.edamamUserMacroCache.findMany({
    where: {
      userId,
      recipeId: {
        in: recipeIds,
      },
    },
  });

  const total = {
    calories: 0,
    protein: 0,
    fat: 0,
    netCarbs: 0,
  };

  const byRecipe = macroCaches.map((cache) => {
    total.calories += cache.calories;
    total.protein += cache.protein;
    total.fat += cache.fat;
    total.netCarbs += cache.netCarbs;

    return {
      recipeId: cache.recipeId,
      macros: {
        calories: cache.calories,
        protein: cache.protein,
        fat: cache.fat,
        netCarbs: cache.netCarbs,
      },
    };
  });

  return {
    total: {
      calories: Math.round(total.calories * 10) / 10,
      protein: Math.round(total.protein * 10) / 10,
      fat: Math.round(total.fat * 10) / 10,
      netCarbs: Math.round(total.netCarbs * 10) / 10,
    },
    byRecipe,
  };
}

/**
 * Clear cached nutrition data for a recipe
 */
export async function clearRecipeNutritionCache(
  recipeId: string,
  userId?: string
): Promise<void> {
  try {
    if (userId) {
      // Clear user-specific cache
      await prisma.edamamUserMacroCache.deleteMany({
        where: {
          recipeId,
          userId,
        },
      });
    } else {
      // Clear all user caches for this recipe
      await prisma.edamamUserMacroCache.deleteMany({
        where: {
          recipeId,
        },
      });
    }

    console.info(
      `[EdamamService] Cleared nutrition cache for recipe: ${recipeId}`
    );
  } catch (error) {
    console.error("[EdamamService] Failed to clear cache:", error);
  }
}
