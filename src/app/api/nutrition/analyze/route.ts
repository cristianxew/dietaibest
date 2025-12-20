/**
 * Nutrition Analysis API Route
 * 
 * POST /api/nutrition/analyze
 * Analyzes recipe nutrition using Edamam API with ETag caching
 * 
 * Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  analyzeRecipeNutrition,
  type RecipeNutritionInput,
  type NutritionAnalysisResult,
  type NutritionAnalysisError,
} from "@/lib/edamam-service";

// ============================================================================
// Request/Response Types
// ============================================================================

interface AnalyzeRequest {
  title: string;
  ingredients: string[];
  servings?: number;
  url?: string;
  instructions?: string[];
  locale?: "en" | "es" | "pl";
  forceRefresh?: boolean;
}

interface AnalyzeResponse {
  success: true;
  data: NutritionAnalysisResult;
}

interface AnalyzeErrorResponse {
  success: false;
  error: string;
  code: string;
  retryable: boolean;
  details?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  return user;
}

// ============================================================================
// POST Handler
// ============================================================================

export async function POST(
  request: NextRequest
): Promise<NextResponse<AnalyzeResponse | AnalyzeErrorResponse>> {
  try {
    // 1. Authenticate user
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          code: "UNAUTHORIZED",
          retryable: false,
        },
        { status: 401 }
      );
    }

    // 2. Parse request body
    let body: AnalyzeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          code: "INVALID_REQUEST",
          retryable: false,
        },
        { status: 400 }
      );
    }

    // 3. Validate required fields
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Recipe title is required",
          code: "INVALID_INPUT",
          retryable: false,
        },
        { status: 400 }
      );
    }

    if (
      !body.ingredients ||
      !Array.isArray(body.ingredients) ||
      body.ingredients.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "At least one ingredient is required",
          code: "INVALID_INPUT",
          retryable: false,
        },
        { status: 400 }
      );
    }

    // 4. Prepare recipe input
    const recipeInput: RecipeNutritionInput = {
      title: body.title,
      ingredients: body.ingredients,
      servings: body.servings || 1,
      url: body.url,
      instructions: body.instructions,
    };

    // 5. Analyze nutrition
    const result = await analyzeRecipeNutrition(recipeInput, user.id, {
      forceRefresh: body.forceRefresh || false,
      locale: body.locale || "en",
    });

    // 6. Check if result is an error
    if ("error" in result) {
      const errorResult = result as NutritionAnalysisError;

      // Map error codes to HTTP status codes
      let statusCode = 500;
      if (errorResult.code === "INVALID_INPUT") {
        statusCode = 400;
      } else if (errorResult.code === "RATE_LIMIT") {
        statusCode = 429;
      } else if (errorResult.code === "PARSE_ERROR") {
        statusCode = 422;
      }

      return NextResponse.json(
        {
          success: false,
          error: errorResult.error,
          code: errorResult.code,
          retryable: errorResult.retryable,
          details: errorResult.details,
        },
        { status: statusCode }
      );
    }

    // 7. Success response
    const successResult = result as NutritionAnalysisResult;

    return NextResponse.json(
      {
        success: true,
        data: successResult,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, max-age=3600", // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    console.error("[API] Nutrition analysis failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        code: "INTERNAL_ERROR",
        retryable: true,
        details:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// OPTIONS Handler (CORS)
// ============================================================================

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

