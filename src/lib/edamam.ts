/**
 * Edamam Nutrition Analysis API Client
 *
 * Implements cost-control via ETag caching and supports resubmission without re-billing.
 * Per Edamam policy: Only 4 macros (calories, protein, fat, net carbs) may be cached per user.
 */

import { createHash } from "crypto";

// ============================================================================
// Type Definitions (from OpenAPI spec)
// ============================================================================

export interface EdamamRecipeInput {
  title: string;
  ingr: string[]; // Array of ingredient lines
  url?: string;
  summary?: string;
  yield?: string; // Number of servings (string to allow "2-4" format)
  time?: string;
  img?: string;
  prep?: string[]; // Cooking instructions
}

export interface EdamamNutrientInfo {
  label: string;
  quantity: number;
  unit: string;
}

export interface EdamamNutrients {
  [key: string]: EdamamNutrientInfo;
}

export interface EdamamParsedIngredient {
  quantity?: number;
  measure?: string;
  measureURI?: string;
  foodMatch?: string;
  food?: string;
  foodId?: string;
  foodURI?: string;
  specificFoodURI?: string;
  foodCategory?: string;
  brand?: string;
  foodContentsLabel?: string;
  weight?: number;
  retainedWeight?: number;
  nutrients?: EdamamNutrients;
  status?: "OK" | "MISSING_QUANTITY" | "UNRECOGNIZED_FOOD";
}

export interface EdamamIngredient {
  text: string;
  parsed?: EdamamParsedIngredient[];
}

export interface EdamamAnalyzedRecipe {
  uri?: string;
  url?: string;
  yield?: number;
  calories?: number;
  glycemicIndex?: number;
  inflammatoryIndex?: number;
  co2EmissionsClass?: string;
  totalWeight?: number;
  dietLabels?: string[];
  healthLabels?: string[];
  cautions?: string[];
  totalNutrients?: EdamamNutrients;
  totalNutrientsKCal?: EdamamNutrients;
  totalDaily?: EdamamNutrients;
  ingredientLines?: string[];
  label?: string;
  preparation?: string[];
  ingredients?: EdamamIngredient[];
  cuisineType?: string[];
  mealType?: string[];
  dishType?: string[];
}

export interface EdamamApiResponse {
  recipe: EdamamAnalyzedRecipe;
  etag?: string; // From response headers
}

export interface EdamamApiError {
  status: number;
  message: string;
  retryable: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

const EDAMAM_API_BASE = "https://api.edamam.com";
const EDAMAM_APP_ID = process.env.EDAMAM_APP_ID;
const EDAMAM_APP_KEY = process.env.EDAMAM_APP_KEY;

if (!EDAMAM_APP_ID || !EDAMAM_APP_KEY) {
  console.warn(
    "[Edamam] API credentials not configured. Set EDAMAM_APP_ID and EDAMAM_APP_KEY environment variables."
  );
}

// Rate limiting configuration
const RATE_LIMIT_DELAY_MS = 1000; // 1 second between requests
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 5000]; // Exponential backoff

// Last request timestamp for rate limiting
let lastRequestTime = 0;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate deterministic fingerprint for recipe content
 * Used to identify duplicate recipes and avoid re-billing
 */
export function generateRecipeFingerprint(recipe: EdamamRecipeInput): string {
  const content = JSON.stringify({
    title: recipe.title.trim().toLowerCase(),
    ingredients: recipe.ingr.map((i) => i.trim().toLowerCase()).sort(),
  });
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Rate limiting: ensure minimum delay between API requests
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    const delay = RATE_LIMIT_DELAY_MS - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  lastRequestTime = Date.now();
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(status: number): boolean {
  // Retry on server errors and rate limits
  return status >= 500 || status === 429;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// API Client
// ============================================================================

export class EdamamClient {
  private appId: string;
  private appKey: string;

  constructor(appId?: string, appKey?: string) {
    this.appId = appId || EDAMAM_APP_ID || "";
    this.appKey = appKey || EDAMAM_APP_KEY || "";

    if (!this.appId || !this.appKey) {
      throw new Error(
        "Edamam API credentials not configured. Set EDAMAM_APP_ID and EDAMAM_APP_KEY."
      );
    }
  }

  /**
   * Analyze a full recipe with nutritional breakdown
   *
   * Supports ETag-based caching for cost control:
   * - Pass stored ETag via ifNoneMatch to check if recipe data is still current
   * - Returns 304 if unchanged (no charge)
   * - Pass force=true with ifNoneMatch to re-fetch body without new charge
   */
  async analyzeRecipe(
    recipe: EdamamRecipeInput,
    options: {
      ifNoneMatch?: string; // ETag from previous analysis
      force?: boolean; // Force re-evaluation even with valid ETag
      kitchen?: "home" | "commercial";
      locale?: string; // Default: "en"
      accountUser?: string; // For active user tracking
    } = {}
  ): Promise<{
    data: EdamamAnalyzedRecipe | null;
    etag: string | null;
    status: number;
    fromCache: boolean;
  }> {
    await enforceRateLimit();

    const url = new URL(`${EDAMAM_API_BASE}/api/nutrition-details`);
    url.searchParams.set("app_id", this.appId);
    url.searchParams.set("app_key", this.appKey);

    // Request all fields (use * to get all available data)
    // url.searchParams.append("field", "*");

    if (options.kitchen) {
      url.searchParams.set("kitchen", options.kitchen);
    }

    if (options.force) {
      url.searchParams.set("force", "true");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options.locale && options.locale !== "en") {
      headers["Content-Language"] = options.locale;
    }

    if (options.ifNoneMatch) {
      headers["If-None-Match"] = options.ifNoneMatch;
    }

    if (options.accountUser) {
      headers["Edamam-Account-User"] = options.accountUser;
    }

    let lastError: EdamamApiError | null = null;

    // Retry loop
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.info(`[Edamam] Request URL: ${url.toString()}`);
        console.info(
          `[Edamam] Recipe data: ${JSON.stringify(recipe).substring(0, 200)}...`
        );

        const response = await fetch(url.toString(), {
          method: "POST",
          headers,
          body: JSON.stringify(recipe),
        });

        const etag = response.headers.get("ETag") || null;

        // 304 Not Modified - recipe unchanged, use cached data
        if (response.status === 304) {
          console.info(
            `[Edamam] Recipe unchanged (304), ETag: ${options.ifNoneMatch}`
          );
          return {
            data: null,
            etag: options.ifNoneMatch || null,
            status: 304,
            fromCache: true,
          };
        }

        // 200 OK - successful analysis
        if (response.status === 200) {
          const data = await response.json();
          console.info(`[Edamam] Recipe analyzed successfully, ETag: ${etag}`);
          console.info(
            `[Edamam] Response keys: ${Object.keys(data).join(", ")}`
          );
          console.info(
            `[Edamam] Full response: ${JSON.stringify(data).substring(
              0,
              500
            )}...`
          );
          console.info(
            `[Edamam] Calories: ${
              data.calories
            }, Has totalNutrients: ${!!data.totalNutrients}`
          );
          return {
            data,
            etag,
            status: 200,
            fromCache: false,
          };
        }

        // 409 Conflict - ETag doesn't match recipe content
        if (response.status === 409) {
          console.warn(
            `[Edamam] ETag conflict (409) - recipe content changed, treating as new recipe`
          );
          // Retry without ETag
          if (options.ifNoneMatch) {
            delete headers["If-None-Match"];
            options.ifNoneMatch = undefined;
            continue;
          }
        }

        // Error responses
        const errorText = await response.text();
        lastError = {
          status: response.status,
          message: errorText || response.statusText,
          retryable: isRetryableError(response.status),
        };

        // Log specific error cases
        if (response.status === 404) {
          console.error(`[Edamam] URL not found or couldn't be retrieved`);
        } else if (response.status === 422) {
          console.error(
            `[Edamam] Couldn't parse recipe or extract nutritional info`
          );
        } else if (response.status === 555) {
          console.error(`[Edamam] Recipe quality insufficient for processing`);
        }

        // Retry if error is retryable
        if (lastError.retryable && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt] || 5000;
          console.warn(
            `[Edamam] Retryable error (${response.status}), attempt ${
              attempt + 1
            }/${MAX_RETRIES}, retrying in ${delay}ms...`
          );
          await sleep(delay);
          continue;
        }

        throw lastError;
      } catch (error) {
        // Network or parsing errors
        if (error instanceof Error) {
          lastError = {
            status: 0,
            message: error.message,
            retryable: true,
          };
        }

        // Retry on network errors
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt] || 5000;
          console.warn(
            `[Edamam] Network error, attempt ${
              attempt + 1
            }/${MAX_RETRIES}, retrying in ${delay}ms...`
          );
          await sleep(delay);
          continue;
        }

        throw lastError || error;
      }
    }

    // All retries exhausted
    throw lastError || new Error("Failed to analyze recipe after retries");
  }

  /**
   * Analyze individual ingredient line
   * Useful for single ingredient nutritional lookup
   */
  async analyzeIngredient(
    ingredient: string,
    options: {
      nutritionType?: "cooking" | "logging";
      ifNoneMatch?: string;
      accountUser?: string;
    } = {}
  ): Promise<EdamamAnalyzedRecipe | null> {
    await enforceRateLimit();

    const url = new URL(`${EDAMAM_API_BASE}/api/nutrition-data`);
    url.searchParams.set("app_id", this.appId);
    url.searchParams.set("app_key", this.appKey);
    url.searchParams.set("ingr", ingredient);

    if (options.nutritionType) {
      url.searchParams.set("nutrition-type", options.nutritionType);
    }

    const headers: Record<string, string> = {};

    if (options.ifNoneMatch) {
      headers["If-None-Match"] = options.ifNoneMatch;
    }

    if (options.accountUser) {
      headers["Edamam-Account-User"] = options.accountUser;
    }

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers,
      });

      if (response.status === 304) {
        return null; // Not modified
      }

      if (!response.ok) {
        throw new Error(`Edamam API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Edamam] Ingredient analysis failed:", error);
      throw error;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let edamamClientInstance: EdamamClient | null = null;

export function getEdamamClient(): EdamamClient {
  if (!edamamClientInstance) {
    edamamClientInstance = new EdamamClient();
  }
  return edamamClientInstance;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Aggregate nutrients from ingredients to create totalNutrients
 * Edamam returns nutrients per ingredient, we need to sum them up
 */
function aggregateIngredientsNutrients(
  response: EdamamAnalyzedRecipe
): EdamamNutrients {
  const totals: Record<string, EdamamNutrientInfo> = {};

  if (!response.ingredients || !Array.isArray(response.ingredients)) {
    return {};
  }

  for (const ingredient of response.ingredients) {
    if (!ingredient.parsed || !Array.isArray(ingredient.parsed)) continue;

    for (const parsed of ingredient.parsed) {
      if (!parsed.nutrients) continue;

      for (const [nutrientKey, nutrientInfo] of Object.entries(
        parsed.nutrients
      )) {
        if (!totals[nutrientKey]) {
          totals[nutrientKey] = {
            label: nutrientInfo.label,
            quantity: 0,
            unit: nutrientInfo.unit,
          };
        }
        totals[nutrientKey].quantity += nutrientInfo.quantity;
      }
    }
  }

  return totals;
}

/**
 * Calculate total calories from ingredients
 */
function calculateTotalCalories(response: EdamamAnalyzedRecipe): number {
  if (response.calories) return response.calories;

  const nutrients = aggregateIngredientsNutrients(response);
  return nutrients.ENERC_KCAL?.quantity || 0;
}

/**
 * Extract the 4 cacheable macros from Edamam response
 * Per Edamam policy: Only these 4 values may be stored per user
 */
export function extractCacheableMacros(
  response: EdamamAnalyzedRecipe,
  servings: number = 1
): {
  calories: number;
  protein: number;
  fat: number;
  netCarbs: number;
} {
  const perServing = servings > 0 ? servings : 1;

  // Aggregate nutrients from ingredients if not in top level
  const totalNutrients =
    response.totalNutrients || aggregateIngredientsNutrients(response);
  const calories = response.calories || calculateTotalCalories(response);

  const caloriesPerServing = calories / perServing;
  const protein = (totalNutrients?.PROCNT?.quantity || 0) / perServing;
  const fat = (totalNutrients?.FAT?.quantity || 0) / perServing;

  // Net carbs = Total carbs - Fiber
  const totalCarbs = (totalNutrients?.CHOCDF?.quantity || 0) / perServing;
  const fiber = (totalNutrients?.FIBTG?.quantity || 0) / perServing;
  const netCarbs = Math.max(0, totalCarbs - fiber);

  return {
    calories: Math.round(caloriesPerServing * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    netCarbs: Math.round(netCarbs * 10) / 10,
  };
}

/**
 * Extract all nutrients for immediate display (not for persistent storage)
 */
export function extractAllNutrients(
  response: EdamamAnalyzedRecipe
): Record<string, { label: string; quantity: number; unit: string }> {
  // If totalNutrients exists, use it; otherwise aggregate from ingredients
  return response.totalNutrients || aggregateIngredientsNutrients(response);
}

/**
 * Extract diet and health labels
 */
export function extractLabels(response: EdamamAnalyzedRecipe): {
  dietLabels: string[];
  healthLabels: string[];
  cautions: string[];
} {
  return {
    dietLabels: response.dietLabels || [],
    healthLabels: response.healthLabels || [],
    cautions: response.cautions || [],
  };
}
