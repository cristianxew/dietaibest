/**
 * Nutrition Analysis API Endpoint
 *
 * POST /api/nutrition/analyze
 *
 * Processes ingredient lists to provide comprehensive nutritional analysis including:
 * - Macro and micronutrient calculations
 * - Diet compatibility classification
 * - Allergen detection and warnings
 * - Confidence scoring and ingredient matching
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { parseIngredients } from "@/utils/ingredientParser";
import { calculateRecipeNutrition } from "@/services/nutritionCalculator";
import { classifyRecipeDiets } from "@/services/dietClassifier";
import { detectRecipeAllergens } from "@/services/allergenDetector";

// Rate limiting store (in-memory for now)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Development helper to clear rate limit
export function clearRateLimit(): void {
  if (process.env.NODE_ENV === "development") {
    rateLimitStore.clear();
    console.log("🔄 Rate limit store cleared for development");
  }
}

// Request validation schema
const analyzeRequestSchema = z.object({
  ingredients: z
    .array(z.string())
    .min(1, "At least one ingredient is required"),
  servings: z.number().min(1).max(100).default(1),
  options: z
    .object({
      includeNutrition: z.boolean().default(true),
      includeDiets: z.boolean().default(true),
      includeAllergens: z.boolean().default(true),
      includeConfidence: z.boolean().default(true),
      strictMode: z.boolean().default(false),
    })
    .default({}),
});

// Response interfaces
interface NutritionAnalysisResponse {
  success: boolean;
  data?: {
    ingredients: Array<{
      original: string;
      parsed: {
        name: string;
        quantity: number | null;
        unit: string | null;
        preparation: string | null;
        confidence: number;
      };
      matched?: {
        ingredient: {
          id: string;
          name: string;
          foodGroup: string;
        };
        confidence: string;
        score: number;
      };
      warnings: string[];
    }>;
    nutrition?: {
      totalNutrients: Array<{
        nutrient: {
          id: string;
          name: string;
          nutrientCategory: string;
        };
        value: number;
        unit: string;
        percentDailyValue?: number;
        confidence: number;
      }>;
      perServing: Array<{
        nutrient: {
          id: string;
          name: string;
          nutrientCategory: string;
        };
        value: number;
        unit: string;
        percentDailyValue?: number;
        confidence: number;
      }>;
      servings: number;
      overallConfidence: number;
    };
    dietCompatibility?: {
      classifications: Array<{
        dietTypeName: string;
        isCompatible: boolean;
        confidence: number;
        reasons: string[];
        modifications?: string[];
      }>;
      primaryDiets: string[];
      partialDiets: string[];
      macroAnalysis: {
        carbPercentage: number;
        proteinPercentage: number;
        fatPercentage: number;
        isKetogenic: boolean;
        isHighProtein: boolean;
        isLowFat: boolean;
        isBalanced: boolean;
      };
    };
    allergens?: {
      detectedAllergens: Array<{
        allergenId: string;
        allergenName: string;
        category: string;
        severity: string;
        detectionType: string;
        confidence: number;
        sources: string[];
        containsAmount?: string;
        warnings?: string[];
      }>;
      riskLevel: string;
      recommendedLabels: string[];
    };
    metadata: {
      processingTime: number;
      totalIngredients: number;
      matchedIngredients: number;
      confidence: number;
      warnings: string[];
    };
  };
  error?: string;
}

// Rate limiting helper
function checkRateLimit(userId: string): {
  allowed: boolean;
  remaining: number;
} {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = process.env.NODE_ENV === "development" ? 100 : 30; // Higher limit for development

  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now >= userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (userLimit.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: maxRequests - userLimit.count };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<NutritionAnalysisResponse>> {
  const startTime = Date.now();

  try {
    // Authentication check
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    // Rate limiting check
    const rateLimitResult = checkRateLimit(session.user.email);
    if (!rateLimitResult.allowed) {
      console.warn(
        `⚠️ Rate limit exceeded for user: ${session.user.email}`,
        `Remaining requests: ${rateLimitResult.remaining}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": (Date.now() + 60000).toString(),
          },
        }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedRequest = analyzeRequestSchema.parse(body);
    const { ingredients, servings, options } = validatedRequest;

    console.log(
      `🔍 Analyzing ${ingredients.length} ingredients for ${servings} servings`
    );

    // Parse ingredients
    const parsedIngredients = parseIngredients(ingredients);

    // Initialize response data
    const responseData: NonNullable<NutritionAnalysisResponse["data"]> = {
      ingredients: parsedIngredients.map((parsed) => ({
        original: parsed.originalText,
        parsed: {
          name: parsed.name,
          quantity: parsed.quantity,
          unit: parsed.unit,
          preparation: parsed.preparation,
          confidence: parsed.confidence,
        },
        warnings: parsed.errors,
      })),
      metadata: {
        processingTime: 0,
        totalIngredients: ingredients.length,
        matchedIngredients: 0,
        confidence: 0,
        warnings: [],
      },
    };

    // Calculate nutrition if requested
    if (options.includeNutrition) {
      console.log("🧮 Calculating nutrition...");
      const nutritionResult = await calculateRecipeNutrition(
        parsedIngredients,
        {
          servings,
          includePercentDV: true,
          fuzzyMatchThreshold: options.strictMode ? 0.8 : 0.6,
        }
      );

      responseData.nutrition = {
        totalNutrients: nutritionResult.totalNutrients,
        perServing: nutritionResult.perServing,
        servings: nutritionResult.servings,
        overallConfidence: nutritionResult.overallConfidence,
      };

      responseData.metadata.matchedIngredients =
        nutritionResult.ingredientBreakdown.filter(
          (ing) => ing.matchedIngredient
        ).length;

      responseData.metadata.warnings.push(...nutritionResult.warnings);

      // Update ingredient data with matching info
      nutritionResult.ingredientBreakdown.forEach((ingResult, index) => {
        if (ingResult.matchedIngredient && responseData.ingredients[index]) {
          responseData.ingredients[index].matched = {
            ingredient: {
              id: ingResult.ingredient.id,
              name: ingResult.ingredient.name,
              foodGroup: ingResult.ingredient.foodGroup || "Unknown",
            },
            confidence: ingResult.matchedIngredient.confidence,
            score: ingResult.matchedIngredient.score,
          };
        }
        if (ingResult.warnings) {
          responseData.ingredients[index].warnings.push(...ingResult.warnings);
        }
      });
    }

    // Classify diets if requested
    if (options.includeDiets) {
      console.log("🥗 Classifying diets...");

      // Get the actual nutrition result for diet classification if available
      let nutritionForDiets;
      if (options.includeNutrition && responseData.nutrition) {
        // Re-run nutrition calculation to get the full RecipeNutrition object
        nutritionForDiets = await calculateRecipeNutrition(parsedIngredients, {
          servings,
          includePercentDV: true,
          fuzzyMatchThreshold: options.strictMode ? 0.8 : 0.6,
        });
      }

      const dietResult = await classifyRecipeDiets(
        parsedIngredients,
        nutritionForDiets,
        { strictMode: options.strictMode }
      );

      responseData.dietCompatibility = {
        classifications: dietResult.classifications,
        primaryDiets: dietResult.primaryDiets,
        partialDiets: dietResult.partialDiets,
        macroAnalysis: dietResult.macroAnalysis,
      };

      responseData.metadata.warnings.push(...dietResult.warnings);
    }

    // Detect allergens if requested
    if (options.includeAllergens) {
      console.log("⚠️ Detecting allergens...");
      const allergenResult = await detectRecipeAllergens(parsedIngredients, {
        includeCrossContamination: true,
        sensitivityLevel: options.strictMode ? "high" : "standard",
      });

      responseData.allergens = {
        detectedAllergens: allergenResult.detectedAllergens,
        riskLevel: allergenResult.riskLevel,
        recommendedLabels: allergenResult.recommendedLabels,
      };

      responseData.metadata.warnings.push(...allergenResult.warnings);
    }

    // Calculate final metadata
    const processingTime = Date.now() - startTime;
    responseData.metadata.processingTime = processingTime;
    responseData.metadata.confidence =
      responseData.nutrition?.overallConfidence || 0;

    // Add response headers
    const headers = new Headers({
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-Processing-Time": processingTime.toString(),
    });

    console.log(
      `✅ Analysis completed in ${processingTime}ms with ${responseData.metadata.confidence}% confidence`
    );

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("❌ Nutrition analysis failed:", error);

    // Handle specific error types
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid request: ${error.errors[0].message}`,
        },
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : "Internal server error. Please try again later.",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "healthy",
    service: "Nutrition Analysis API",
    version: "1.0.0",
    features: [
      "Ingredient parsing and matching",
      "Nutritional calculations",
      "Diet compatibility analysis",
      "Allergen detection",
      "Confidence scoring",
      "Rate limiting",
    ],
    limits: {
      maxIngredients: 50,
      maxServings: 100,
      rateLimit:
        process.env.NODE_ENV === "development"
          ? "100 requests/minute"
          : "30 requests/minute",
    },
    timestamp: new Date().toISOString(),
  });
}

// Development-only route to clear rate limit
export async function DELETE(): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 }
    );
  }

  rateLimitStore.clear();
  return NextResponse.json({
    message: "Rate limit store cleared",
    timestamp: new Date().toISOString(),
  });
}
