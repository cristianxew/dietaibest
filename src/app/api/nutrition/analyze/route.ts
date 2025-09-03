/**
 * Nutrition Analysis API Endpoint
 *
 * Implements a staged pipeline for nutrition analysis:
 * 1. Parse and validate request
 * 2. Process ingredients asynchronously
 * 3. Return nutrition data with confidence scores
 *
 * Uses hybrid approach: local data + USDA fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  calculateNutrition,
  parseIngredientString,
  getSummaryNutrition,
  type IngredientInput,
} from "@/services/nutritionCalculator";
import { getNutritionDataProvider } from "@/services/nutritionDataProvider";
import { getNutritionCacheStats } from "@/services/nutritionCache";

// Request validation schema
const AnalyzeRequestSchema = z.object({
  ingredients: z.array(z.string()).min(1).max(100),
  servings: z.number().positive().default(1),
  options: z
    .object({
      includeNutrition: z.boolean().default(true),
      includeDiets: z.boolean().default(false),
      includeAllergens: z.boolean().default(false),
      includeConfidence: z.boolean().default(true),
      strictMode: z.boolean().default(false),
      preferUSDA: z.boolean().default(false),
    })
    .optional(),
});

// Rate limiting (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(clientId);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (limit.count >= RATE_LIMIT) {
    return false;
  }

  limit.count++;
  return true;
}

// Clear rate limits (for development)
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    rateLimitMap.clear();
    return NextResponse.json({ message: "Rate limits cleared" });
  }
  return NextResponse.json({ error: "Not allowed" }, { status: 403 });
}

// Get cache statistics
export async function GET(request: NextRequest) {
  try {
    const stats = getNutritionCacheStats();
    const dataProvider = getNutritionDataProvider();
    const providerStats = dataProvider.getCacheStats();

    return NextResponse.json({
      success: true,
      data: {
        cache: stats,
        provider: providerStats,
        rateLimit: {
          limit: RATE_LIMIT,
          window: RATE_LIMIT_WINDOW / 1000,
          unit: "seconds",
        },
      },
    });
  } catch (error) {
    console.error("Error getting stats:", error);
    return NextResponse.json(
      { error: "Failed to get statistics" },
      { status: 500 }
    );
  }
}

// Main analysis endpoint
export async function POST(request: NextRequest) {
  try {
    // Get client ID for rate limiting (use IP or session)
    const clientId =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        {
          error:
            "Rate limit exceeded. Please wait before making another request.",
          retryAfter: 60,
        },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = AnalyzeRequestSchema.parse(body);

    // Parse ingredient strings
    const parsedIngredients: IngredientInput[] = [];
    const parseErrors: string[] = [];

    for (const ingredientStr of validatedData.ingredients) {
      const parsed = parseIngredientString(ingredientStr);
      if (parsed) {
        parsedIngredients.push(parsed);
      } else if (validatedData.options?.strictMode) {
        parseErrors.push(`Failed to parse: ${ingredientStr}`);
      } else {
        // In non-strict mode, add with default values
        parsedIngredients.push({
          name: ingredientStr,
          amount: 1,
          unit: "serving",
        });
      }
    }

    // Return error if strict mode and parsing failed
    if (validatedData.options?.strictMode && parseErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to parse some ingredients",
          details: parseErrors,
        },
        { status: 400 }
      );
    }

    // Calculate nutrition
    const nutritionResult = await calculateNutrition(parsedIngredients, {
      servings: validatedData.servings,
      preferUSDA: validatedData.options?.preferUSDA,
      includeConfidence: validatedData.options?.includeConfidence !== false,
    });

    // Prepare response based on requested options
    const response: any = {
      success: true,
      data: {
        metadata: {
          totalIngredients: nutritionResult.metadata.totalIngredients,
          matchedIngredients: nutritionResult.metadata.matchedIngredients,
          confidence: nutritionResult.overallConfidence,
          warnings: [...parseErrors, ...nutritionResult.metadata.warnings],
          sources: {
            local: nutritionResult.metadata.localMatches,
            usda: nutritionResult.metadata.usdaMatches,
            cached: nutritionResult.metadata.cachedMatches,
          },
        },
      },
    };

    // Add nutrition data if requested
    if (validatedData.options?.includeNutrition !== false) {
      const summary = getSummaryNutrition(nutritionResult.perServing);

      response.data.nutrition = {
        totalNutrients: nutritionResult.totalNutrients,
        perServing: nutritionResult.perServing,
        servings: nutritionResult.servings,
        overallConfidence: nutritionResult.overallConfidence,
        summary, // Quick access to main nutrients
      };
    }

    // Add diet compatibility if requested (placeholder for now)
    if (validatedData.options?.includeDiets) {
      response.data.dietCompatibility = {
        classifications: [],
        primaryDiets: [],
        partialDiets: [],
        macroAnalysis: calculateMacroAnalysis(nutritionResult.perServing),
      };
    }

    // Add allergen info if requested (placeholder for now)
    if (validatedData.options?.includeAllergens) {
      response.data.allergens = {
        detectedAllergens: [],
        riskLevel: "low",
        recommendedLabels: [],
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Nutrition analysis error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze nutrition",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate macro distribution for diet analysis
 */
function calculateMacroAnalysis(nutrients: any[]): any {
  const summary = getSummaryNutrition(nutrients);
  const totalCalories = summary.calories || 0;

  if (totalCalories === 0) {
    return {
      carbPercentage: 0,
      proteinPercentage: 0,
      fatPercentage: 0,
      isKetogenic: false,
      isHighProtein: false,
      isLowFat: false,
      isBalanced: false,
    };
  }

  // Calculate calories from macros
  const proteinCalories = (summary.protein || 0) * 4;
  const carbCalories = (summary.carbs || 0) * 4;
  const fatCalories = (summary.fat || 0) * 9;

  const totalMacroCalories = proteinCalories + carbCalories + fatCalories;

  // Calculate percentages
  const proteinPercentage =
    totalMacroCalories > 0
      ? Math.round((proteinCalories / totalMacroCalories) * 100)
      : 0;
  const carbPercentage =
    totalMacroCalories > 0
      ? Math.round((carbCalories / totalMacroCalories) * 100)
      : 0;
  const fatPercentage =
    totalMacroCalories > 0
      ? Math.round((fatCalories / totalMacroCalories) * 100)
      : 0;

  return {
    carbPercentage,
    proteinPercentage,
    fatPercentage,
    isKetogenic: carbPercentage < 10 && fatPercentage > 60,
    isHighProtein: proteinPercentage > 30,
    isLowFat: fatPercentage < 20,
    isBalanced:
      Math.abs(carbPercentage - 50) < 10 &&
      Math.abs(proteinPercentage - 25) < 10 &&
      Math.abs(fatPercentage - 25) < 10,
  };
}
