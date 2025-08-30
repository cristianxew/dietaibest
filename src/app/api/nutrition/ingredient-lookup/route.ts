/**
 * Ingredient Lookup API Endpoint
 *
 * GET /api/nutrition/ingredient-lookup
 *
 * Provides nutritional information for a single ingredient including:
 * - Nutritional values per 100g
 * - Nutritional values for custom quantities
 * - Ingredient matching with fuzzy search
 * - Unit conversion support
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { fuzzyMatchIngredient } from "@/utils/fuzzyMatcher";
import { getIngredientNutrition } from "@/services/nutritionCalculator";
import { prisma } from "@/lib/prisma";

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Request validation schema
const ingredientLookupSchema = z.object({
  ingredient: z.string().min(1, "Ingredient name is required"),
  quantity: z.number().positive().optional(),
  unit: z.string().optional(),
  exact: z.boolean().default(false), // If true, requires exact match
});

// Response interface
interface IngredientLookupResponse {
  success: boolean;
  data?: {
    query: {
      ingredient: string;
      quantity?: number;
      unit?: string;
      exact: boolean;
    };
    matches: Array<{
      ingredient: {
        id: string;
        name: string;
        foodGroup: string;
        description?: string;
        source: string;
      };
      confidence: string;
      score: number;
      isExact: boolean;
    }>;
    selectedMatch?: {
      ingredient: {
        id: string;
        name: string;
        foodGroup: string;
        description?: string;
        source: string;
      };
      parsedQuantity?: {
        quantity: number;
        unit: string;
        quantityInGrams: number;
      };
      nutritionPer100g: Array<{
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
      nutritionForQuantity?: Array<{
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
    };
    metadata: {
      totalMatches: number;
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
  const maxRequests = 60; // 60 requests per minute (more lenient than analyze)

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

// Helper function to convert quantity to grams
function convertToGrams(
  quantity: number,
  unit: string | null
): {
  grams: number;
  confidence: number;
  warning?: string;
} {
  // Basic unit conversions (simplified version)
  const unitConversions: Record<string, number> = {
    g: 1,
    gram: 1,
    grams: 1,
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    mg: 0.001,
    milligram: 0.001,
    milligrams: 0.001,
    oz: 28.35,
    ounce: 28.35,
    ounces: 28.35,
    lb: 453.59,
    pound: 453.59,
    pounds: 453.59,
    // Volume to weight (approximate)
    ml: 1, // Assuming water density
    milliliter: 1,
    milliliters: 1,
    l: 1000,
    liter: 1000,
    liters: 1000,
    cup: 240,
    cups: 240,
    tbsp: 15,
    tablespoon: 15,
    tablespoons: 15,
    tsp: 5,
    teaspoon: 5,
    teaspoons: 5,
  };

  if (!unit) {
    return {
      grams: quantity * 100, // Default to 100g per unit
      confidence: 0.5,
      warning: "No unit specified, assuming 100g per unit",
    };
  }

  const normalizedUnit = unit.toLowerCase().trim();
  const conversion = unitConversions[normalizedUnit];

  if (conversion) {
    return {
      grams: quantity * conversion,
      confidence:
        normalizedUnit.includes("ml") || normalizedUnit.includes("cup")
          ? 0.8
          : 1.0,
      warning:
        normalizedUnit.includes("ml") || normalizedUnit.includes("cup")
          ? "Volume to weight conversion using water density"
          : undefined,
    };
  }

  // Count-based units
  if (["piece", "pieces", "item", "items"].includes(normalizedUnit)) {
    return {
      grams: quantity * 100, // Assume 100g per piece
      confidence: 0.6,
      warning: "Count-based unit converted using estimated weight",
    };
  }

  return {
    grams: quantity * 100,
    confidence: 0.3,
    warning: `Unknown unit "${unit}", assuming 100g per unit`,
  };
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<IngredientLookupResponse>> {
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
    const { searchParams } = new URL(request.url);
    const queryParams = {
      ingredient: searchParams.get("ingredient") || "",
      quantity: searchParams.get("quantity")
        ? parseFloat(searchParams.get("quantity")!)
        : undefined,
      unit: searchParams.get("unit") || undefined,
      exact: searchParams.get("exact") === "true",
    };

    const validatedRequest = ingredientLookupSchema.parse(queryParams);
    const { ingredient, quantity, unit, exact } = validatedRequest;

    console.log(
      `🔍 Looking up ingredient: "${ingredient}"${
        quantity ? ` (${quantity}${unit || ""})` : ""
      }`
    );

    // Fetch all ingredients for matching
    const allIngredients = await prisma.ingredient.findMany();

    // Perform fuzzy matching
    const matches = await fuzzyMatchIngredient(ingredient, allIngredients, {
      threshold: exact ? 0.95 : 0.5,
      maxResults: exact ? 1 : 10,
      includeSubstitutions: !exact,
    });

    const warnings: string[] = [];

    // Prepare response data
    const responseData: NonNullable<IngredientLookupResponse["data"]> = {
      query: {
        ingredient,
        quantity,
        unit,
        exact,
      },
      matches: matches.map((match) => ({
        ingredient: {
          id: match.ingredient.id,
          name: match.ingredient.name,
          foodGroup: match.ingredient.foodGroup || "Unknown",
          description: match.ingredient.description || undefined,
          source: match.ingredient.source || "Unknown",
        },
        confidence: match.confidence,
        score: match.score,
        isExact: match.score >= 0.95,
      })),
      metadata: {
        totalMatches: matches.length,
        processingTime: 0,
        warnings,
      },
    };

    // If we have matches, get nutrition for the best match
    if (matches.length > 0) {
      const bestMatch = matches[0];

      // Get nutrition per 100g
      const nutritionPer100g = await getIngredientNutrition(
        bestMatch.ingredient.id,
        bestMatch.ingredient.name,
        100
      );

      // Parse the ingredient string if quantity is provided
      let parsedQuantity;
      let quantityInGrams;
      if (quantity) {
        const conversion = convertToGrams(quantity, unit || null);
        quantityInGrams = conversion.grams;

        if (conversion.warning) {
          warnings.push(conversion.warning);
        }

        parsedQuantity = {
          quantity,
          unit: unit || "unit",
          quantityInGrams,
        };
      }

      // Get nutrition for the specific quantity if provided
      let nutritionForQuantity;
      if (quantityInGrams) {
        nutritionForQuantity = await getIngredientNutrition(
          bestMatch.ingredient.id,
          bestMatch.ingredient.name,
          quantityInGrams
        );
      }

      responseData.selectedMatch = {
        ingredient: {
          id: bestMatch.ingredient.id,
          name: bestMatch.ingredient.name,
          foodGroup: bestMatch.ingredient.foodGroup || "Unknown",
          description: bestMatch.ingredient.description || undefined,
          source: bestMatch.ingredient.source || "Unknown",
        },
        parsedQuantity,
        nutritionPer100g,
        nutritionForQuantity,
      };
    } else {
      warnings.push(`No matches found for "${ingredient}"`);
    }

    // Calculate final metadata
    const processingTime = Date.now() - startTime;
    responseData.metadata.processingTime = processingTime;
    responseData.metadata.warnings = warnings;

    // Add response headers
    const headers = new Headers({
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-Processing-Time": processingTime.toString(),
    });

    console.log(`✅ Ingredient lookup completed in ${processingTime}ms`);

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("❌ Ingredient lookup failed:", error);

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
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({
    status: "healthy",
    service: "Ingredient Lookup API",
    version: "1.0.0",
    supportedMethods: ["GET"],
    parameters: {
      ingredient: "required string - ingredient name to lookup",
      quantity: "optional number - quantity amount",
      unit: "optional string - unit of measurement",
      exact: "optional boolean - require exact match (default: false)",
    },
    examples: {
      basic: "/api/nutrition/ingredient-lookup?ingredient=apple",
      withQuantity:
        "/api/nutrition/ingredient-lookup?ingredient=apple&quantity=1&unit=cup",
      exact: "/api/nutrition/ingredient-lookup?ingredient=apple&exact=true",
    },
    limits: {
      rateLimit: "60 requests/minute",
      maxResults: 10,
    },
    timestamp: new Date().toISOString(),
  });
}
