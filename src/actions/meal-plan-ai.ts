"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { CoordinatorAgent } from "@/lib/agents/coordinator";
import type { PlanningContext, AIGeneratedPlan } from "@/types/ai-agents";
import type { MealType } from "@/types/meal-plan";

// ============================================================================
// Helper Functions
// ============================================================================

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

// ============================================================================
// AI Meal Plan Generation
// ============================================================================

export interface GenerateAIMealPlanParams {
  templateId: string;
  duration: number;
  mealSlots: MealType[];
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
}

export interface GenerateAIMealPlanResult {
  data: AIGeneratedPlan | null;
  error: string | null;
}

/**
 * Generate an AI-powered meal plan using multi-agent collaboration
 */
export async function generateAIMealPlan(
  params: GenerateAIMealPlanParams
): Promise<GenerateAIMealPlanResult> {
  try {
    const user = await getAuthenticatedUser();

    // Get user profile
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      include: {
        familyMembers: true,
      },
    });

    if (!profile) {
      return {
        data: null,
        error: "User profile not found. Please complete onboarding first.",
      };
    }

    // Get user's recipes
    const recipes = await prisma.recipe.findMany({
      where: {
        userId: user.id,
      },
      include: {
        categories: true,
      },
    });

    if (recipes.length === 0) {
      return {
        data: null,
        error: "No recipes found. Please add some recipes before generating a meal plan.",
      };
    }

    // Only include recipes with nutrition data
    const recipesWithNutrition = recipes.filter(
      recipe => recipe.calories !== null && recipe.protein !== null
    );

    if (recipesWithNutrition.length === 0) {
      return {
        data: null,
        error: "No recipes with nutritional data found. Please analyze your recipes first.",
      };
    }

    // Build planning context
    const context: PlanningContext = {
      userId: user.id,
      templateId: params.templateId,
      duration: params.duration,
      mealSlots: params.mealSlots,
      targets: {
        calories: params.targetCalories || profile.dailyCalories,
        protein: params.targetProtein || profile.proteinGrams,
        carbs: params.targetCarbs || profile.carbsGrams,
        fat: params.targetFat || profile.fatGrams,
      },
      userProfile: {
        dietaryType: profile.dietaryType || [],
        allergies: profile.allergies || [],
        cuisinePrefs: profile.cuisinePrefs || [],
        dailyCalories: profile.dailyCalories,
        proteinGrams: profile.proteinGrams,
        carbsGrams: profile.carbsGrams,
        fatGrams: profile.fatGrams,
      },
      familyMembers: profile.familyMembers.map(member => ({
        name: member.name,
        dietaryNeeds: member.dietaryNeeds || [],
      })),
      availableRecipes: recipesWithNutrition,
    };

    // Initialize coordinator and generate plan
    const coordinator = new CoordinatorAgent();
    const plan = await coordinator.generateMealPlan(context);

    return {
      data: plan,
      error: null,
    };
  } catch (error) {
    console.error("Generate AI meal plan error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to generate meal plan",
    };
  }
}

/**
 * Apply AI-generated suggestions to a meal plan template
 */
export async function applyAISuggestionsToTemplate(
  templateId: string,
  suggestions: AIGeneratedPlan["suggestions"]
) {
  try {
    const user = await getAuthenticatedUser();

    // Verify template ownership
    const template = await prisma.mealPlanTemplate.findUnique({
      where: { id: templateId },
      select: { userId: true },
    });

    if (!template) {
      return { data: null, error: "Meal plan template not found" };
    }

    if (template.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Get all days for this template
    const days = await prisma.mealPlanDay.findMany({
      where: { templateId },
      orderBy: { dayNumber: "asc" },
    });

    // Clear existing meals
    await prisma.mealPlanMeal.deleteMany({
      where: {
        mealPlanDayId: {
          in: days.map(d => d.id),
        },
      },
    });

    // Group suggestions by day
    const suggestionsByDay = suggestions.reduce((acc, suggestion) => {
      if (!acc[suggestion.dayNumber]) {
        acc[suggestion.dayNumber] = [];
      }
      acc[suggestion.dayNumber].push(suggestion);
      return acc;
    }, {} as Record<number, typeof suggestions>);

    // Add new meals based on suggestions
    for (const day of days) {
      const daySuggestions = suggestionsByDay[day.dayNumber] || [];

      for (const suggestion of daySuggestions) {
        await prisma.mealPlanMeal.create({
          data: {
            mealPlanDayId: day.id,
            recipeId: suggestion.recipeId,
            mealType: suggestion.mealType,
            servings: suggestion.servings,
            sortOrder: 0,
          },
        });
      }
    }

    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Apply AI suggestions error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to apply suggestions",
    };
  }
}
