/**
 * Recipe Enhancement API Endpoint
 *
 * POST /api/recipes/enhance
 *
 * Provides comprehensive AI-powered recipe enhancement including:
 * - Quality analysis and scoring
 * - Automatic categorization and tagging
 * - Advanced nutrition analysis
 * - Recipe improvement suggestions
 * - Standardization and optimization
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RecipeFormData, recipeFormSchema } from "@/types/recipe";
import { enhanceRecipe } from "@/lib/recipe-enhancement";
import {
  calculateDetailedNutrition,
  compareAgainstTargets,
  generateNutritionRecommendations,
} from "@/lib/nutrition-analyzer";

// Request schema
const enhanceRequestSchema = z.object({
  recipe: recipeFormSchema,
  options: z
    .object({
      includeNutritionAnalysis: z.boolean().default(true),
      includeQualityAnalysis: z.boolean().default(true),
      includeAutoCategories: z.boolean().default(true),
      includeAutoTags: z.boolean().default(true),
      includeImprovements: z.boolean().default(true),
      useExternalNutritionAPI: z.boolean().default(false),
      userMacroTargets: z
        .object({
          dailyCalories: z.number(),
          proteinGrams: z.number(),
          carbsGrams: z.number(),
          fatGrams: z.number(),
        })
        .optional(),
    })
    .default({}),
});

// Response interface
interface EnhanceResponse {
  success: boolean;
  data?: {
    // Enhanced recipe with improvements applied
    enhancedRecipe: RecipeFormData;

    // Quality analysis
    qualityScore: {
      overall: number;
      completeness: number;
      clarity: number;
      nutrition: number;
      practicality: number;
      suggestions: string[];
    };

    // Auto-generated categories and tags
    autoCategories: string[];
    autoTags: string[];

    // Comprehensive nutrition analysis
    nutritionAnalysis: {
      basic: {
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        fiber: number;
      };
      detailed: {
        micronutrients: Record<string, number>;
        healthScores: {
          nutritionDensity: number;
          proteinQuality: number;
          antioxidantScore: number;
          inflammatoryScore: number;
          glycemicIndex: number;
        };
        dietaryFlags: string[];
      };
      recommendations: string[];
    };

    // Improvement suggestions
    improvements: Array<{
      type: "ingredient" | "instruction" | "nutrition" | "presentation";
      severity: "low" | "medium" | "high";
      suggestion: string;
      originalValue?: string;
      suggestedValue?: string;
    }>;

    // Target comparison (if user targets provided)
    targetComparison?: {
      macros: Record<
        string,
        {
          actual: number;
          target: number;
          percentage: number;
          status: "under" | "over" | "good";
        }
      >;
      recommendations: string[];
    };

    // Processing metadata
    metadata: {
      processingTime: number;
      enhancementsApplied: string[];
      confidenceScore: number;
      version: string;
    };
  };
  error?: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<EnhanceResponse>> {
  const startTime = Date.now();

  try {
    console.log("🔧 Recipe enhancement request received");

    // Parse and validate request
    const body = await request.json();
    const validatedRequest = enhanceRequestSchema.parse(body);
    const { recipe, options } = validatedRequest;

    console.log("📝 Enhancing recipe:", recipe.title);

    // Initialize response data
    const enhancementsApplied: string[] = [];
    const enhancedRecipe = { ...recipe };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qualityScore: any = null;
    let autoCategories: string[] = [];
    let autoTags: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let nutritionAnalysis: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let improvements: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let targetComparison: any = null;

    // 1. Core AI Enhancement
    console.log("🤖 Running AI enhancement analysis...");
    const aiEnhancement = await enhanceRecipe(recipe);

    if (options.includeQualityAnalysis) {
      qualityScore = aiEnhancement.qualityScore;
      enhancementsApplied.push("quality-analysis");
    }

    if (options.includeAutoCategories) {
      autoCategories = aiEnhancement.autoCategories;
      enhancementsApplied.push("auto-categorization");
    }

    if (options.includeAutoTags) {
      autoTags = aiEnhancement.autoTags;
      enhancedRecipe.tags = [...(recipe.tags || []), ...autoTags];
      enhancementsApplied.push("auto-tagging");
    }

    if (options.includeImprovements) {
      improvements = aiEnhancement.improvements;
      enhancementsApplied.push("improvement-suggestions");
    }

    // 2. Advanced Nutrition Analysis
    if (options.includeNutritionAnalysis) {
      console.log("🧮 Calculating detailed nutrition...");

      const detailedNutrition = await calculateDetailedNutrition(
        recipe.ingredients,
        recipe.servings || 1,
        options.useExternalNutritionAPI
      );

      // Apply nutrition data to enhanced recipe
      enhancedRecipe.calories = detailedNutrition.calories;
      enhancedRecipe.protein = detailedNutrition.protein;
      enhancedRecipe.carbs = detailedNutrition.carbohydrates;
      enhancedRecipe.fat = detailedNutrition.fat;
      enhancedRecipe.fiber = detailedNutrition.fiber;
      enhancedRecipe.sodium = detailedNutrition.sodium;

      // Generate nutrition recommendations
      const nutritionRecommendations =
        generateNutritionRecommendations(detailedNutrition);

      nutritionAnalysis = {
        basic: {
          calories: detailedNutrition.calories,
          protein: detailedNutrition.protein,
          carbs: detailedNutrition.carbohydrates,
          fat: detailedNutrition.fat,
          fiber: detailedNutrition.fiber,
        },
        detailed: {
          micronutrients: {
            sodium: detailedNutrition.sodium,
            potassium: detailedNutrition.potassium,
            calcium: detailedNutrition.calcium,
            iron: detailedNutrition.iron,
            vitaminC: detailedNutrition.vitaminC,
            vitaminA: detailedNutrition.vitaminA,
            vitaminD: detailedNutrition.vitaminD,
            vitaminB12: detailedNutrition.vitaminB12,
            folate: detailedNutrition.folate,
          },
          healthScores: {
            nutritionDensity: detailedNutrition.nutritionDensity,
            proteinQuality: detailedNutrition.proteinQuality,
            antioxidantScore: detailedNutrition.antioxidantScore,
            inflammatoryScore: detailedNutrition.inflammatoryScore,
            glycemicIndex: detailedNutrition.glycemicIndex,
          },
          dietaryFlags: aiEnhancement.nutritionAnalysis.dietaryFlags,
        },
        recommendations: nutritionRecommendations,
      };

      enhancementsApplied.push("advanced-nutrition");
    }

    // 3. Target Comparison (if user targets provided)
    if (options.userMacroTargets && nutritionAnalysis) {
      console.log("🎯 Comparing against user macro targets...");

      const targetData = compareAgainstTargets(
        {
          calories: nutritionAnalysis.basic.calories,
          protein: nutritionAnalysis.basic.protein,
          carbohydrates: nutritionAnalysis.basic.carbs,
          fat: nutritionAnalysis.basic.fat,
          fiber: nutritionAnalysis.basic.fiber,
          // Include other required properties with defaults
          sugar: 0,
          saturatedFat: 0,
          unsaturatedFat: 0,
          sodium: nutritionAnalysis.detailed.micronutrients.sodium,
          potassium: nutritionAnalysis.detailed.micronutrients.potassium,
          calcium: nutritionAnalysis.detailed.micronutrients.calcium,
          iron: nutritionAnalysis.detailed.micronutrients.iron,
          vitaminC: nutritionAnalysis.detailed.micronutrients.vitaminC,
          vitaminA: nutritionAnalysis.detailed.micronutrients.vitaminA,
          vitaminD: nutritionAnalysis.detailed.micronutrients.vitaminD,
          vitaminB12: nutritionAnalysis.detailed.micronutrients.vitaminB12,
          folate: nutritionAnalysis.detailed.micronutrients.folate,
          cholesterol: 0,
          glycemicIndex: nutritionAnalysis.detailed.healthScores.glycemicIndex,
          inflammatoryScore:
            nutritionAnalysis.detailed.healthScores.inflammatoryScore,
          nutritionDensity:
            nutritionAnalysis.detailed.healthScores.nutritionDensity,
          proteinQuality:
            nutritionAnalysis.detailed.healthScores.proteinQuality,
          antioxidantScore:
            nutritionAnalysis.detailed.healthScores.antioxidantScore,
        },
        options.userMacroTargets
      );

      targetComparison = {
        macros: targetData.comparison,
        recommendations: targetData.recommendations,
      };

      enhancementsApplied.push("target-comparison");
    }

    // Calculate processing time and confidence score
    const processingTime = Date.now() - startTime;

    // Calculate confidence score based on data completeness and quality
    let confidenceScore = 80; // Base confidence

    if (recipe.ingredients.length >= 3) confidenceScore += 5;
    if (recipe.instructions.length >= 3) confidenceScore += 5;
    if (recipe.description && recipe.description.length > 20)
      confidenceScore += 5;
    if (qualityScore && qualityScore.overall > 70) confidenceScore += 5;

    confidenceScore = Math.min(100, confidenceScore);

    console.log(
      `✅ Recipe enhancement completed in ${processingTime}ms with ${confidenceScore}% confidence`
    );

    return NextResponse.json({
      success: true,
      data: {
        enhancedRecipe,
        qualityScore,
        autoCategories,
        autoTags,
        nutritionAnalysis,
        improvements,
        targetComparison,
        metadata: {
          processingTime,
          enhancementsApplied,
          confidenceScore,
          version: "1.0.0",
        },
      },
    });
  } catch (error) {
    console.error("❌ Recipe enhancement failed:", error);

    // Provide specific error messages based on error type
    let errorMessage = "Failed to enhance recipe. Please try again.";

    if (error instanceof z.ZodError) {
      errorMessage =
        "Invalid recipe data provided. Please check your recipe format.";
    } else if (error instanceof Error) {
      // Don't expose internal errors in production
      if (process.env.NODE_ENV === "development") {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 400 }
    );
  }
}

// Health check endpoint
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status: "healthy",
    service: "Recipe Enhancement API",
    version: "1.0.0",
    features: [
      "AI-powered quality analysis",
      "Automatic categorization",
      "Advanced nutrition calculation",
      "Recipe improvement suggestions",
      "Macro target comparison",
      "Ingredient standardization",
    ],
    timestamp: new Date().toISOString(),
  });
}
