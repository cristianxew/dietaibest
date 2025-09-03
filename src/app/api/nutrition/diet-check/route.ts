/**
 * Diet Compatibility Check API Endpoint
 *
 * POST /api/nutrition/diet-check
 *
 * Checks ingredient compatibility with specific diets including:
 * - Ingredient-based compatibility verification
 * - Macronutrient ratio analysis
 * - Modification suggestions for incompatible ingredients
 * - Confidence scoring for diet classifications
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { parseIngredients } from "@/utils/ingredientParser";
import { classifyRecipeDiets } from "@/services/dietClassifier";
import {
  calculateNutrition,
  parseIngredientString,
  type NutrientResult,
} from "@/services/nutritionCalculator";

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Request validation schema
const dietCheckSchema = z.object({
  ingredients: z
    .array(z.string())
    .min(1, "At least one ingredient is required"),
  diets: z.array(z.string()).min(1, "At least one diet type is required"),
  servings: z.number().min(1).max(100).default(1),
  options: z
    .object({
      strictMode: z.boolean().default(false),
      includeNutrition: z.boolean().default(true),
      includeModifications: z.boolean().default(true),
      includeMacroAnalysis: z.boolean().default(true),
    })
    .default({}),
});

// Response interface
interface DietCheckResponse {
  success: boolean;
  data?: {
    query: {
      ingredients: string[];
      diets: string[];
      servings: number;
      options: {
        strictMode: boolean;
        includeNutrition: boolean;
        includeModifications: boolean;
        includeMacroAnalysis: boolean;
      };
    };
    results: Array<{
      dietType: string;
      isCompatible: boolean;
      confidence: number;
      reasons: string[];
      modifications?: string[];
      incompatibleIngredients?: string[];
      suggestions?: string[];
    }>;
    macroAnalysis?: {
      carbPercentage: number;
      proteinPercentage: number;
      fatPercentage: number;
      isKetogenic: boolean;
      isHighProtein: boolean;
      isLowFat: boolean;
      isBalanced: boolean;
      recommendations?: string[];
    };
    nutritionSummary?: {
      totalCalories: number;
      totalProtein: number;
      totalCarbs: number;
      totalFat: number;
      perServing: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
      };
    };
    metadata: {
      totalIngredients: number;
      totalDiets: number;
      processingTime: number;
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
  const maxRequests = 45; // 45 requests per minute

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

// Helper function to map diet analysis to response format
function mapDietAnalysisToResponse(
  analysis: Awaited<ReturnType<typeof classifyRecipeDiets>>,
  requestedDiets: string[]
) {
  return requestedDiets.map((requestedDiet) => {
    // Find matching classification (case-insensitive)
    const classification = analysis.classifications.find(
      (c) => c.dietTypeName.toLowerCase() === requestedDiet.toLowerCase()
    );

    if (!classification) {
      return {
        dietType: requestedDiet,
        isCompatible: false,
        confidence: 0,
        reasons: [`Diet type "${requestedDiet}" not found in analysis`],
        suggestions: ["Please check the diet type name and try again"],
      };
    }

    return {
      dietType: classification.dietTypeName,
      isCompatible: classification.isCompatible,
      confidence: classification.confidence,
      reasons: classification.reasons,
      modifications: classification.modifications,
      incompatibleIngredients: classification.violations,
      suggestions: classification.alternativeIngredients
        ? Array.from(classification.alternativeIngredients.values()).flat()
        : undefined,
    };
  });
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<DietCheckResponse>> {
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
    const validatedRequest = dietCheckSchema.parse(body);
    const { ingredients, diets, servings, options } = validatedRequest;

    console.log(
      `🥗 Checking ${ingredients.length} ingredients against ${diets.length} diets`
    );

    // Parse ingredients for diet classification (needs detailed parsing)
    const parsedIngredientsForDiet = parseIngredients(ingredients);

    // Parse ingredients for nutrition calculation (simpler format)
    const parsedIngredientsForNutrition = ingredients
      .map(parseIngredientString)
      .filter(
        (ing): ing is NonNullable<ReturnType<typeof parseIngredientString>> =>
          ing !== null
      );

    // Initialize response data
    const warnings: string[] = [];

    // If no ingredients could be parsed for nutrition, add warning
    if (parsedIngredientsForNutrition.length === 0 && ingredients.length > 0) {
      warnings.push("Could not parse ingredients for nutrition analysis");
    }

    // Calculate nutrition if needed
    let nutritionResult;
    if (options.includeNutrition || options.includeMacroAnalysis) {
      console.log("🧮 Calculating nutrition for diet analysis...");

      if (parsedIngredientsForNutrition.length > 0) {
        const calcResult = await calculateNutrition(
          parsedIngredientsForNutrition,
          {
            servings,
            preferUSDA: !options.strictMode,
            includeConfidence: true,
          }
        );

        // Convert to format expected by dietClassifier
        nutritionResult = {
          totalNutrients: calcResult.totalNutrients,
          perServing: calcResult.perServing,
          servings: calcResult.servings,
          warnings: calcResult.metadata.warnings,
        };

        warnings.push(...calcResult.metadata.warnings);
      }
    }

    // Perform diet classification
    console.log("🔍 Analyzing diet compatibility...");
    const dietAnalysis = await classifyRecipeDiets(
      parsedIngredientsForDiet,
      nutritionResult,
      { strictMode: options.strictMode }
    );

    warnings.push(...dietAnalysis.warnings);

    // Map analysis results to requested diets
    const results = mapDietAnalysisToResponse(dietAnalysis, diets);

    // Prepare response data
    const responseData: NonNullable<DietCheckResponse["data"]> = {
      query: {
        ingredients,
        diets,
        servings,
        options,
      },
      results,
      metadata: {
        totalIngredients: ingredients.length,
        totalDiets: diets.length,
        processingTime: 0,
        warnings,
      },
    };

    // Add macro analysis if requested
    if (options.includeMacroAnalysis && dietAnalysis.macroAnalysis) {
      responseData.macroAnalysis = {
        ...dietAnalysis.macroAnalysis,
        recommendations: [], // Could be enhanced with specific recommendations
      };
    }

    // Add nutrition summary if requested
    if (options.includeNutrition && nutritionResult) {
      // Find key nutrients
      const findNutrient = (name: string) =>
        nutritionResult.perServing.find(
          (n: NutrientResult) =>
            n.nutrient.name.toLowerCase() === name.toLowerCase() ||
            n.nutrient.name.toLowerCase().includes(name.toLowerCase())
        )?.value || 0;

      const calories = findNutrient("Energy") || findNutrient("Calories");
      const protein = findNutrient("Protein");
      const carbs = findNutrient("Carbohydrates") || findNutrient("Carbs");
      const fat = findNutrient("Total Fat") || findNutrient("Fat");

      responseData.nutritionSummary = {
        totalCalories: calories * servings,
        totalProtein: protein * servings,
        totalCarbs: carbs * servings,
        totalFat: fat * servings,
        perServing: {
          calories,
          protein,
          carbs,
          fat,
        },
      };
    }

    // Calculate final metadata
    const processingTime = Date.now() - startTime;
    responseData.metadata.processingTime = processingTime;

    // Add response headers
    const headers = new Headers({
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-Processing-Time": processingTime.toString(),
    });

    console.log(`✅ Diet compatibility check completed in ${processingTime}ms`);

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("❌ Diet compatibility check failed:", error);

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
    service: "Diet Compatibility Check API",
    version: "1.0.0",
    supportedMethods: ["POST"],
    supportedDiets: [
      "vegan",
      "vegetarian",
      "keto",
      "paleo",
      "mediterranean",
      "low-carb",
      "high-protein",
      "low-fat",
      "gluten-free",
      "dairy-free",
    ],
    requestFormat: {
      ingredients: "array of ingredient strings",
      diets: "array of diet type strings",
      servings: "number (default: 1)",
      options: {
        strictMode: "boolean (default: false)",
        includeNutrition: "boolean (default: true)",
        includeModifications: "boolean (default: true)",
        includeMacroAnalysis: "boolean (default: true)",
      },
    },
    limits: {
      maxIngredients: 50,
      maxDiets: 10,
      maxServings: 100,
      rateLimit: "45 requests/minute",
    },
    timestamp: new Date().toISOString(),
  });
}
