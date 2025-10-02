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
  getSummaryNutrition,
  type IngredientInput,
  type NutrientResult,
} from "@/services/nutritionCalculator";
import { parseIngredient } from "@/utils/ingredientParser";
import { getNutritionDataProvider } from "@/services/nutritionDataProvider";
import { getNutritionCacheStats } from "@/services/nutritionCache";
import {
  handleParsingError,
  handleAPIError,
  formatErrorForUser,
  aggregateErrors,
  type NutritionError,
} from "@/services/nutritionErrorHandler";

// Request validation schema
const AnalyzeRequestSchema = z.object({
  ingredients: z.array(z.string()).min(1).max(100),
  servings: z.number().positive().default(1),
  options: z
    .object({
      includeNutrition: z.boolean().default(true),
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
export async function DELETE() {
  if (process.env.NODE_ENV === "development") {
    rateLimitMap.clear();
    return NextResponse.json({ message: "Rate limits cleared" });
  }
  return NextResponse.json({ error: "Not allowed" }, { status: 403 });
}

// Get cache statistics
export async function GET() {
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

    // Parse ingredient strings with error handling
    const parsedIngredients: IngredientInput[] = [];
    const parseErrors: NutritionError[] = [];
    const warnings: string[] = [];

    for (const ingredientStr of validatedData.ingredients) {
      const parsed = parseIngredient(ingredientStr);

      // Use the comprehensive parser's results
      if (parsed && parsed.name && parsed.confidence > 0) {
        parsedIngredients.push({
          name: parsed.name,
          amount: parsed.quantity || 1,
          unit: parsed.unit || "serving",
        });

        // Add parsing errors/warnings if confidence is low
        if (parsed.confidence < 0.8) {
          warnings.push(
            `Low confidence parsing: "${ingredientStr}" (${Math.round(
              parsed.confidence * 100
            )}% confidence)`
          );
        }

        // Include any parser errors as warnings
        if (parsed.errors.length > 0) {
          warnings.push(
            `Parsing issues for "${ingredientStr}": ${parsed.errors.join(", ")}`
          );
        }
      } else {
        // Handle parsing error
        const error = handleParsingError(ingredientStr);
        parseErrors.push(error);

        if (validatedData.options?.strictMode) {
          // In strict mode, don't use fallback
          continue;
        } else {
          // In non-strict mode, use fallback values
          if (error.fallbackValue) {
            parsedIngredients.push(error.fallbackValue);
            warnings.push(formatErrorForUser(error));
          } else {
            parsedIngredients.push({
              name: ingredientStr,
              amount: 1,
              unit: "serving",
            });
            warnings.push(
              `Could not parse: "${ingredientStr}" - using defaults`
            );
          }
        }
      }
    }

    // Return error if strict mode and parsing failed
    if (validatedData.options?.strictMode && parseErrors.length > 0) {
      const errorSummary = aggregateErrors(parseErrors);
      return NextResponse.json(
        {
          success: false,
          error: errorSummary.summary,
          details: parseErrors.map((e) => ({
            ingredient: e.ingredient,
            message: e.userMessage,
            suggestions: e.suggestions,
          })),
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

    // Debug logging to help identify data quality issues
    if (process.env.NODE_ENV === "development") {
      console.log("🔍 Nutrition Analysis Debug:", {
        totalIngredients: parsedIngredients.length,
        matchedIngredients: nutritionResult.metadata.matchedIngredients,
        nutrientsFound: nutritionResult.totalNutrients.length,
        nutrientNames: nutritionResult.totalNutrients.map(
          (n) => n.nutrient.name
        ),
        nutrientIds: nutritionResult.totalNutrients.map((n) => n.nutrient.id),
        summary: getSummaryNutrition(nutritionResult.perServing),
        missingCoreMacros: [
          "Energy",
          "Protein",
          "Total Fat",
          "Carbohydrates",
          "Fiber",
        ].filter(
          (macro) =>
            !nutritionResult.totalNutrients.some((n) =>
              n.nutrient.name.includes(macro)
            )
        ),
      });
    }

    // Prepare response based on requested options
    interface ResponseData {
      metadata: {
        totalIngredients: number;
        matchedIngredients: number;
        confidence: number;
        warnings: string[];
        errors?: Array<{
          type: string;
          ingredient?: string;
          message: string;
          suggestions?: string[];
        }>;
        sources: {
          local: number;
          usda: number;
          cached: number;
        };
      };
      nutrition?: {
        totalNutrients: NutrientResult[];
        perServing: NutrientResult[];
        servings: number;
        overallConfidence: number;
        summary: ReturnType<typeof getSummaryNutrition>;
      };
    }

    const response: { success: boolean; data: ResponseData } = {
      success: true,
      data: {
        metadata: {
          totalIngredients: nutritionResult.metadata.totalIngredients,
          matchedIngredients: nutritionResult.metadata.matchedIngredients,
          confidence: nutritionResult.overallConfidence,
          warnings: [...warnings, ...nutritionResult.metadata.warnings],
          errors:
            parseErrors.length > 0
              ? parseErrors.map((e) => ({
                  type: e.type,
                  ingredient: e.ingredient,
                  message: e.userMessage,
                  suggestions: e.suggestions,
                }))
              : undefined,
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

    // Use error handler for API errors
    const apiError = handleAPIError(
      error instanceof Error ? error : new Error("Unknown error"),
      "/api/nutrition/analyze"
    );

    return NextResponse.json(
      {
        success: false,
        error: apiError.userMessage,
        details: {
          type: apiError.type,
          message: error instanceof Error ? error.message : "Unknown error",
          suggestions: apiError.suggestions,
        },
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate macro distribution for diet analysis
 */
// function calculateMacroAnalysis(nutrients: NutrientResult[]): {
//   carbPercentage: number;
//   proteinPercentage: number;
//   fatPercentage: number;
//   isKetogenic: boolean;
//   isHighProtein: boolean;
//   isLowFat: boolean;
//   isBalanced: boolean;
// } {
//   const summary = getSummaryNutrition(nutrients);
//   const totalCalories = summary.calories || 0;

//   if (totalCalories === 0) {
//     return {
//       carbPercentage: 0,
//       proteinPercentage: 0,
//       fatPercentage: 0,
//       isKetogenic: false,
//       isHighProtein: false,
//       isLowFat: false,
//       isBalanced: false,
//     };
//   }

//   // Calculate calories from macros
//   const proteinCalories = (summary.protein || 0) * 4;
//   const carbCalories = (summary.carbs || 0) * 4;
//   const fatCalories = (summary.fat || 0) * 9;

//   const totalMacroCalories = proteinCalories + carbCalories + fatCalories;

//   // Calculate percentages
//   const proteinPercentage =
//     totalMacroCalories > 0
//       ? Math.round((proteinCalories / totalMacroCalories) * 100)
//       : 0;
//   const carbPercentage =
//     totalMacroCalories > 0
//       ? Math.round((carbCalories / totalMacroCalories) * 100)
//       : 0;
//   const fatPercentage =
//     totalMacroCalories > 0
//       ? Math.round((fatCalories / totalMacroCalories) * 100)
//       : 0;

//   return {
//     carbPercentage,
//     proteinPercentage,
//     fatPercentage,
//     isKetogenic: carbPercentage < 10 && fatPercentage > 60,
//     isHighProtein: proteinPercentage > 30,
//     isLowFat: fatPercentage < 20,
//     isBalanced:
//       Math.abs(carbPercentage - 50) < 10 &&
//       Math.abs(proteinPercentage - 25) < 10 &&
//       Math.abs(fatPercentage - 25) < 10,
//   };
// }
