"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { getRecipeStats, getRecentRecipes } from "./recipe";
import { getActiveMealPlanSchedule, getMealPlanStats } from "./meal-plan";
import { getUserProfile } from "./profile";

// Helper to get authenticated user
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

// Types for dashboard data
export interface DashboardData {
  profile: Awaited<ReturnType<typeof getUserProfile>>["data"];
  recipeStats: Awaited<ReturnType<typeof getRecipeStats>>["data"];
  mealPlanStats: Awaited<ReturnType<typeof getMealPlanStats>>["data"];
  recentRecipes: Awaited<ReturnType<typeof getRecentRecipes>>["data"];
  activePlan: Awaited<ReturnType<typeof getActiveMealPlanSchedule>>["data"];
  weeklyMacros: WeeklyMacroData[];
}

export interface WeeklyMacroData {
  date: string;
  dayName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  hasData: boolean;
  isToday: boolean;
  isFuture: boolean;
}

// Get all dashboard data in parallel
export async function getDashboardData(): Promise<{
  data: DashboardData | null;
  error: string | null;
}> {
  try {
    await getAuthenticatedUser();

    const [
      profileResult,
      recipeStatsResult,
      mealPlanStatsResult,
      recentRecipesResult,
      activePlanResult,
      weeklyMacrosResult,
    ] = await Promise.all([
      getUserProfile(),
      getRecipeStats(),
      getMealPlanStats(),
      getRecentRecipes(6),
      getActiveMealPlanSchedule(),
      getWeeklyMacroHistory(),
    ]);

    return {
      data: {
        profile: profileResult.data,
        recipeStats: recipeStatsResult.data,
        mealPlanStats: mealPlanStatsResult.data,
        recentRecipes: recentRecipesResult.data,
        activePlan: activePlanResult.data,
        weeklyMacros: weeklyMacrosResult.data || [],
      },
      error: null,
    };
  } catch (error) {
    console.error("Get dashboard data error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to get dashboard data",
    };
  }
}

// Get weekly macro history for charts
export async function getWeeklyMacroHistory(): Promise<{
  data: WeeklyMacroData[] | null;
  error: string | null;
}> {
  try {
    const user = await getAuthenticatedUser();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get current week (Monday to Sunday)
    const weekData: WeeklyMacroData[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // Find Monday of current week
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysFromMonday);

    // Find Sunday of current week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // Fetch all schedules that could cover any day of this week
    const schedules = await prisma.mealPlanSchedule.findMany({
      where: {
        userId: user.id,
        status: { in: ["active", "completed"] },
        startDate: { lte: sunday },
      },
      include: {
        template: {
          include: {
            days: {
              include: {
                meals: {
                  include: {
                    recipe: {
                      select: {
                        calories: true,
                        protein: true,
                        carbs: true,
                        fat: true,
                        servings: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    // Loop through Mon (0) to Sun (6)
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      date.setHours(0, 0, 0, 0);

      const dayMacros = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        hasData: false,
      };

      // Find schedule that covers this date
      for (const schedule of schedules) {
        const startDate = new Date(schedule.startDate);
        startDate.setHours(0, 0, 0, 0);

        const daysSinceStart = Math.floor(
          (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if this day is within the plan duration
        if (daysSinceStart >= 0 && daysSinceStart < schedule.template.duration) {
          const dayNumber = daysSinceStart + 1;
          const planDay = schedule.template.days.find(
            (d) => d.dayNumber === dayNumber
          );

          if (planDay && planDay.meals.length > 0) {
            dayMacros.hasData = true;
            for (const meal of planDay.meals) {
              if (meal.recipe) {
                // Recipe values are PER-SERVING, multiply by meal servings
                dayMacros.calories += (meal.recipe.calories || 0) * meal.servings;
                dayMacros.protein += (meal.recipe.protein || 0) * meal.servings;
                dayMacros.carbs += (meal.recipe.carbs || 0) * meal.servings;
                dayMacros.fat += (meal.recipe.fat || 0) * meal.servings;
              }
            }
            break; // Found data for this day, no need to check other schedules
          }
        }
      }

      const isToday = date.getTime() === today.getTime();
      const isFuture = date.getTime() > today.getTime();

      weekData.push({
        date: date.toISOString().split("T")[0],
        dayName: dayNames[date.getDay()],
        calories: Math.round(dayMacros.calories),
        protein: Math.round(dayMacros.protein),
        carbs: Math.round(dayMacros.carbs),
        fat: Math.round(dayMacros.fat),
        hasData: dayMacros.hasData,
        isToday,
        isFuture,
      });
    }

    return { data: weekData, error: null };
  } catch (error) {
    console.error("Get weekly macro history error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get weekly macro history",
    };
  }
}

// Get today's macro totals from active plan
export async function getTodaysMacros(): Promise<{
  data: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    targetCalories: number | null;
    targetProtein: number | null;
    targetCarbs: number | null;
    targetFat: number | null;
  } | null;
  error: string | null;
}> {
  try {
    const [activePlanResult, profileResult] = await Promise.all([
      getActiveMealPlanSchedule(),
      getUserProfile(),
    ]);

    const activePlan = activePlanResult.data;
    const profile = profileResult.data;

    // Calculate today's macros from active plan
    const todaysMacros = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };

    if (activePlan?.todaysMeals) {
      for (const meal of activePlan.todaysMeals) {
        const recipe = meal.recipe;
        if (recipe) {
          // Recipe values are PER-SERVING, multiply by meal servings
          todaysMacros.calories += (recipe.calories || 0) * meal.servings;
          todaysMacros.protein += (recipe.protein || 0) * meal.servings;
          todaysMacros.carbs += (recipe.carbs || 0) * meal.servings;
          todaysMacros.fat += (recipe.fat || 0) * meal.servings;
        }
      }
    }

    return {
      data: {
        calories: Math.round(todaysMacros.calories),
        protein: Math.round(todaysMacros.protein),
        carbs: Math.round(todaysMacros.carbs),
        fat: Math.round(todaysMacros.fat),
        targetCalories:
          activePlan?.targetCalories || profile?.dailyCalories || null,
        targetProtein:
          activePlan?.targetProtein || profile?.proteinGrams || null,
        targetCarbs: activePlan?.targetCarbs || profile?.carbsGrams || null,
        targetFat: activePlan?.targetFat || profile?.fatGrams || null,
      },
      error: null,
    };
  } catch (error) {
    console.error("Get today's macros error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get today's macros",
    };
  }
}
