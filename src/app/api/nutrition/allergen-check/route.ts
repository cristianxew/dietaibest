/**
 * Allergen Detection API Endpoint
 *
 * POST /api/nutrition/allergen-check
 *
 * Detects potential allergens in ingredients including:
 * - Direct allergen detection from ingredient database
 * - Derived allergen detection (e.g., butter contains milk)
 * - Cross-contamination risk assessment
 * - Allergen severity classification
 * - Substitution suggestions for allergen-free alternatives
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { parseIngredients } from "@/utils/ingredientParser";
import { detectRecipeAllergens } from "@/services/allergenDetector";

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Request validation schema
const allergenCheckSchema = z.object({
  ingredients: z
    .array(z.string())
    .min(1, "At least one ingredient is required"),
  userAllergens: z.array(z.string()).optional(),
  options: z
    .object({
      includeCrossContamination: z.boolean().default(true),
      sensitivityLevel: z.enum(["standard", "high"]).default("standard"),
      includeSubstitutions: z.boolean().default(true),
      groupByCategory: z.boolean().default(true),
    })
    .default({}),
});

// Response interface
interface AllergenCheckResponse {
  success: boolean;
  data?: {
    query: {
      ingredients: string[];
      userAllergens?: string[];
      options: {
        includeCrossContamination: boolean;
        sensitivityLevel: "standard" | "high";
        includeSubstitutions: boolean;
        groupByCategory: boolean;
      };
    };
    detectedAllergens: Array<{
      allergenId: string;
      allergenName: string;
      category: string;
      severity: string;
      detectionType: "direct" | "derived" | "cross-contamination";
      confidence: number;
      sources: string[];
      containsAmount?: string;
      warnings?: string[];
    }>;
    allergenGroups?: Record<
      string,
      Array<{
        allergenId: string;
        allergenName: string;
        category: string;
        severity: string;
        detectionType: "direct" | "derived" | "cross-contamination";
        confidence: number;
        sources: string[];
        containsAmount?: string;
        warnings?: string[];
      }>
    >;
    riskAssessment: {
      overallRisk: "none" | "low" | "moderate" | "high" | "severe";
      highRiskAllergens: string[];
      crossContaminationRisks: string[];
      recommendedLabels: string[];
    };
    substitutionSuggestions?: Record<string, string[]>;
    userSpecificWarnings?: Array<{
      allergen: string;
      severity: string;
      message: string;
      urgency: "low" | "medium" | "high";
    }>;
    metadata: {
      totalIngredients: number;
      totalAllergens: number;
      processingTime: number;
      overallConfidence: number;
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

// Helper function to generate user-specific warnings
function generateUserSpecificWarnings(
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
  }>,
  userAllergens?: string[]
) {
  if (!userAllergens || userAllergens.length === 0) {
    return [];
  }

  const userWarnings: Array<{
    allergen: string;
    severity: string;
    message: string;
    urgency: "low" | "medium" | "high";
  }> = [];

  for (const userAllergen of userAllergens) {
    const matchingAllergen = detectedAllergens.find(
      (detected) =>
        detected.allergenName.toLowerCase() === userAllergen.toLowerCase()
    );

    if (matchingAllergen) {
      const urgency =
        matchingAllergen.severity === "severe"
          ? "high"
          : matchingAllergen.severity === "moderate"
          ? "medium"
          : "low";

      userWarnings.push({
        allergen: matchingAllergen.allergenName,
        severity: matchingAllergen.severity,
        message: `WARNING: ${
          matchingAllergen.allergenName
        } detected in ${matchingAllergen.sources.join(", ")}`,
        urgency,
      });
    }
  }

  return userWarnings;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<AllergenCheckResponse>> {
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
    const validatedRequest = allergenCheckSchema.parse(body);
    const { ingredients, userAllergens, options } = validatedRequest;

    console.log(`⚠️ Checking ${ingredients.length} ingredients for allergens`);

    // Parse ingredients
    const parsedIngredients = parseIngredients(ingredients);

    // Detect allergens
    console.log("🔍 Detecting allergens...");
    const allergenAnalysis = await detectRecipeAllergens(parsedIngredients, {
      includeCrossContamination: options.includeCrossContamination,
      sensitivityLevel: options.sensitivityLevel,
      includeSubstitutions: options.includeSubstitutions,
      userAllergens: userAllergens || [],
    });

    // Group allergens by category if requested
    let allergenGroups:
      | Record<string, typeof allergenAnalysis.detectedAllergens>
      | undefined;
    if (options.groupByCategory) {
      allergenGroups = {};
      for (const allergen of allergenAnalysis.detectedAllergens) {
        if (!allergenGroups[allergen.category]) {
          allergenGroups[allergen.category] = [];
        }
        allergenGroups[allergen.category].push(allergen);
      }
    }

    // Generate user-specific warnings
    const userSpecificWarnings = generateUserSpecificWarnings(
      allergenAnalysis.detectedAllergens,
      userAllergens
    );

    // Prepare response data
    const responseData: NonNullable<AllergenCheckResponse["data"]> = {
      query: {
        ingredients,
        userAllergens,
        options,
      },
      detectedAllergens: allergenAnalysis.detectedAllergens,
      allergenGroups,
      riskAssessment: {
        overallRisk: allergenAnalysis.riskLevel,
        highRiskAllergens: allergenAnalysis.detectedAllergens
          .filter((a) => a.severity === "severe")
          .map((a) => a.allergenName),
        crossContaminationRisks: allergenAnalysis.crossContaminationRisks.map(
          (risk) => risk.allergenName
        ),
        recommendedLabels: allergenAnalysis.recommendedLabels,
      },
      substitutionSuggestions: allergenAnalysis.substitutionSuggestions
        ? Object.fromEntries(allergenAnalysis.substitutionSuggestions)
        : undefined,
      userSpecificWarnings:
        userSpecificWarnings.length > 0 ? userSpecificWarnings : undefined,
      metadata: {
        totalIngredients: ingredients.length,
        totalAllergens: allergenAnalysis.detectedAllergens.length,
        processingTime: 0,
        overallConfidence: allergenAnalysis.overallConfidence,
        warnings: allergenAnalysis.warnings,
      },
    };

    // Calculate final metadata
    const processingTime = Date.now() - startTime;
    responseData.metadata.processingTime = processingTime;

    // Add response headers
    const headers = new Headers({
      "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
      "X-Processing-Time": processingTime.toString(),
    });

    console.log(`✅ Allergen check completed in ${processingTime}ms`);

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("❌ Allergen check failed:", error);

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
    service: "Allergen Detection API",
    version: "1.0.0",
    supportedMethods: ["POST"],
    supportedAllergens: [
      "milk",
      "eggs",
      "fish",
      "shellfish",
      "tree nuts",
      "peanuts",
      "wheat",
      "soybeans",
      "sesame",
      "mustard",
      "celery",
      "lupin",
    ],
    detectionTypes: ["direct", "derived", "cross-contamination"],
    sensitivityLevels: ["low", "standard", "high"],
    requestFormat: {
      ingredients: "array of ingredient strings",
      userAllergens: "optional array of user-specific allergens",
      options: {
        includeCrossContamination: "boolean (default: true)",
        sensitivityLevel: "string (standard|high, default: standard)",
        includeSubstitutions: "boolean (default: true)",
        groupByCategory: "boolean (default: true)",
      },
    },
    limits: {
      maxIngredients: 50,
      maxUserAllergens: 20,
      rateLimit: "45 requests/minute",
    },
    timestamp: new Date().toISOString(),
  });
}
