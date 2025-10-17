"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  mealPlanFormSchema,
  addMealSchema,
  moveMealSchema,
  updateMealServingsSchema,
  mealPlanFilterSchema,
  type MealPlanFormData,
  type AddMealData,
  type MoveMealData,
  type UpdateMealServingsData,
  type MealPlanFilter,
  type MealPlanDisplay,
  type DayDisplay,
  type MealDisplay,
} from "@/types/meal-plan";
import { calculateMealMacros, sumMacros } from "@/lib/meal-plan-macros";
import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

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

// Helper to generate share token
function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

// Helper to generate date range for meal plan
function generateDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ============================================================================
// Create Meal Plan
// ============================================================================

export async function createMealPlan(data: MealPlanFormData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = mealPlanFormSchema.parse(data);

    // If setting as active, deactivate other plans
    if (validatedData.isActive) {
      await prisma.mealPlan.updateMany({
        where: { userId: user.id, isActive: true },
        data: { isActive: false },
      });
    }

    // Generate dates for the meal plan
    const dates = generateDateRange(
      validatedData.startDate,
      validatedData.endDate
    );

    // Create meal plan with days
    const mealPlan = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        name: validatedData.name,
        startDate: validatedData.startDate,
        endDate: validatedData.endDate,
        targetCalories: validatedData.targetCalories,
        targetProtein: validatedData.targetProtein,
        targetCarbs: validatedData.targetCarbs,
        targetFat: validatedData.targetFat,
        isActive: validatedData.isActive,
        isPublic: validatedData.isPublic,
        shareToken: validatedData.isPublic ? generateShareToken() : null,
        days: {
          create: dates.map((date) => ({
            date,
            dayOfWeek: date.getDay(),
          })),
        },
      },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/meal-plans");
    return { data: mealPlan, error: null };
  } catch (error) {
    console.error("Create meal plan error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to create meal plan",
    };
  }
}

// ============================================================================
// Update Meal Plan
// ============================================================================

export async function updateMealPlan(id: string, data: MealPlanFormData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = mealPlanFormSchema.parse(data);

    // Check if user owns the meal plan
    const existingPlan = await prisma.mealPlan.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingPlan) {
      return { data: null, error: "Meal plan not found" };
    }

    if (existingPlan.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // If setting as active, deactivate other plans
    if (validatedData.isActive) {
      await prisma.mealPlan.updateMany({
        where: { userId: user.id, isActive: true, NOT: { id } },
        data: { isActive: false },
      });
    }

    // Update meal plan (note: date range changes not supported to keep it simple)
    const mealPlan = await prisma.mealPlan.update({
      where: { id },
      data: {
        name: validatedData.name,
        targetCalories: validatedData.targetCalories,
        targetProtein: validatedData.targetProtein,
        targetCarbs: validatedData.targetCarbs,
        targetFat: validatedData.targetFat,
        isActive: validatedData.isActive,
        isPublic: validatedData.isPublic,
        shareToken: validatedData.isPublic ? generateShareToken() : null,
      },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/meal-plans");
    revalidatePath(`/meal-plans/${id}`);
    return { data: mealPlan, error: null };
  } catch (error) {
    console.error("Update meal plan error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to update meal plan",
    };
  }
}

// ============================================================================
// Delete Meal Plan
// ============================================================================

export async function deleteMealPlan(id: string) {
  try {
    const user = await getAuthenticatedUser();

    // Check if user owns the meal plan
    const existingPlan = await prisma.mealPlan.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingPlan) {
      return { data: null, error: "Meal plan not found" };
    }

    if (existingPlan.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    await prisma.mealPlan.delete({
      where: { id },
    });

    revalidatePath("/meal-plans");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Delete meal plan error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to delete meal plan",
    };
  }
}

// ============================================================================
// Get Meal Plans (List)
// ============================================================================

export async function getMealPlans(filter?: MealPlanFilter) {
  try {
    const user = await getAuthenticatedUser();
    const validatedFilter = mealPlanFilterSchema.parse(filter || {});

    const {
      search,
      isActive,
      startDateFrom,
      startDateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 12,
    } = validatedFilter;

    // Build where clause
    const where: Prisma.MealPlanWhereInput = {
      userId: user.id,
      ...(search && {
        name: { contains: search, mode: "insensitive" },
      }),
      ...(isActive !== undefined && { isActive }),
      ...(startDateFrom && { startDate: { gte: startDateFrom } }),
      ...(startDateTo && { startDate: { lte: startDateTo } }),
    };

    // Get total count
    const totalCount = await prisma.mealPlan.count({ where });

    // Get meal plans with pagination
    const mealPlans = await prisma.mealPlan.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: true,
              },
            },
          },
          orderBy: { date: "asc" },
        },
      },
    });

    return {
      data: {
        mealPlans,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("Get meal plans error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to get meal plans",
    };
  }
}

// ============================================================================
// Get Single Meal Plan
// ============================================================================

export async function getMealPlan(id: string): Promise<{
  data: MealPlanDisplay | null;
  error: string | null;
}> {
  try {
    const user = await getAuthenticatedUser();

    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: true,
              },
              orderBy: [{ mealType: "asc" }, { sortOrder: "asc" }],
            },
          },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!mealPlan) {
      return { data: null, error: "Meal plan not found" };
    }

    // Check authorization
    if (mealPlan.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Transform to display format with calculated macros
    const daysDisplay: DayDisplay[] = mealPlan.days.map((day) => {
      const mealsDisplay: MealDisplay[] = day.meals.map((meal) => {
        const macros = calculateMealMacros(
          meal.recipe.calories || 0,
          meal.recipe.protein || 0,
          meal.recipe.carbs || 0,
          meal.recipe.fat || 0,
          meal.recipe.servings,
          meal.servings
        );

        return {
          id: meal.id,
          recipeId: meal.recipeId,
          recipeName: meal.recipe.title,
          recipeImage: meal.recipe.imageUrl || undefined,
          mealType: meal.mealType as any,
          servings: meal.servings,
          ...macros,
        };
      });

      const dayMacros = sumMacros(mealsDisplay);

      return {
        id: day.id,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        meals: mealsDisplay,
        macros: dayMacros,
      };
    });

    // Calculate weekly macros
    const totalMacros = sumMacros(daysDisplay.map((d) => d.macros));
    const numDays = daysDisplay.length || 1;
    const averageDailyMacros = {
      calories: Math.round((totalMacros.calories / numDays) * 10) / 10,
      protein: Math.round((totalMacros.protein / numDays) * 10) / 10,
      carbs: Math.round((totalMacros.carbs / numDays) * 10) / 10,
      fat: Math.round((totalMacros.fat / numDays) * 10) / 10,
    };

    const mealPlanDisplay: MealPlanDisplay = {
      id: mealPlan.id,
      name: mealPlan.name,
      startDate: mealPlan.startDate,
      endDate: mealPlan.endDate,
      isActive: mealPlan.isActive,
      isPublic: mealPlan.isPublic,
      shareToken: mealPlan.shareToken || undefined,
      targets: {
        calories: mealPlan.targetCalories || undefined,
        protein: mealPlan.targetProtein || undefined,
        carbs: mealPlan.targetCarbs || undefined,
        fat: mealPlan.targetFat || undefined,
      },
      days: daysDisplay,
      weeklyMacros: {
        totalMacros,
        averageDailyMacros,
        days: daysDisplay.map((d) => ({
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          ...d.macros,
        })),
      },
    };

    return { data: mealPlanDisplay, error: null };
  } catch (error) {
    console.error("Get meal plan error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to get meal plan",
    };
  }
}

// ============================================================================
// Get Meal Plan by Share Token (Public)
// ============================================================================

export async function getMealPlanByShareToken(
  shareToken: string
): Promise<{
  data: MealPlanDisplay | null;
  error: string | null;
}> {
  try {
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { shareToken, isPublic: true },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: true,
              },
              orderBy: [{ mealType: "asc" }, { sortOrder: "asc" }],
            },
          },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!mealPlan) {
      return { data: null, error: "Meal plan not found or not public" };
    }

    // Transform to display format (same as getMealPlan)
    const daysDisplay: DayDisplay[] = mealPlan.days.map((day) => {
      const mealsDisplay: MealDisplay[] = day.meals.map((meal) => {
        const macros = calculateMealMacros(
          meal.recipe.calories || 0,
          meal.recipe.protein || 0,
          meal.recipe.carbs || 0,
          meal.recipe.fat || 0,
          meal.recipe.servings,
          meal.servings
        );

        return {
          id: meal.id,
          recipeId: meal.recipeId,
          recipeName: meal.recipe.title,
          recipeImage: meal.recipe.imageUrl || undefined,
          mealType: meal.mealType as any,
          servings: meal.servings,
          ...macros,
        };
      });

      const dayMacros = sumMacros(mealsDisplay);

      return {
        id: day.id,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        meals: mealsDisplay,
        macros: dayMacros,
      };
    });

    const totalMacros = sumMacros(daysDisplay.map((d) => d.macros));
    const numDays = daysDisplay.length || 1;
    const averageDailyMacros = {
      calories: Math.round((totalMacros.calories / numDays) * 10) / 10,
      protein: Math.round((totalMacros.protein / numDays) * 10) / 10,
      carbs: Math.round((totalMacros.carbs / numDays) * 10) / 10,
      fat: Math.round((totalMacros.fat / numDays) * 10) / 10,
    };

    const mealPlanDisplay: MealPlanDisplay = {
      id: mealPlan.id,
      name: mealPlan.name,
      startDate: mealPlan.startDate,
      endDate: mealPlan.endDate,
      isActive: mealPlan.isActive,
      isPublic: mealPlan.isPublic,
      shareToken: mealPlan.shareToken || undefined,
      targets: {
        calories: mealPlan.targetCalories || undefined,
        protein: mealPlan.targetProtein || undefined,
        carbs: mealPlan.targetCarbs || undefined,
        fat: mealPlan.targetFat || undefined,
      },
      days: daysDisplay,
      weeklyMacros: {
        totalMacros,
        averageDailyMacros,
        days: daysDisplay.map((d) => ({
          date: d.date,
          dayOfWeek: d.dayOfWeek,
          ...d.macros,
        })),
      },
    };

    return { data: mealPlanDisplay, error: null };
  } catch (error) {
    console.error("Get meal plan by share token error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get shared meal plan",
    };
  }
}

// ============================================================================
// Duplicate Meal Plan
// ============================================================================

export async function duplicateMealPlan(
  id: string,
  newName?: string,
  newStartDate?: Date
) {
  try {
    const user = await getAuthenticatedUser();

    // Get original meal plan
    const original = await prisma.mealPlan.findUnique({
      where: { id },
      include: {
        days: {
          include: {
            meals: true,
          },
        },
      },
    });

    if (!original) {
      return { data: null, error: "Meal plan not found" };
    }

    if (original.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Calculate new date range
    const originalDuration = Math.ceil(
      (original.endDate.getTime() - original.startDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const startDate = newStartDate || new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + originalDuration);

    const dates = generateDateRange(startDate, endDate);

    // Create duplicate
    const duplicate = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        name: newName || `${original.name} (Copy)`,
        startDate,
        endDate,
        targetCalories: original.targetCalories,
        targetProtein: original.targetProtein,
        targetCarbs: original.targetCarbs,
        targetFat: original.targetFat,
        isActive: false, // Never duplicate as active
        isPublic: false,
        days: {
          create: dates.map((date, index) => {
            const originalDay = original.days[index];
            return {
              date,
              dayOfWeek: date.getDay(),
              meals: originalDay
                ? {
                    create: originalDay.meals.map((meal) => ({
                      recipeId: meal.recipeId,
                      mealType: meal.mealType,
                      servings: meal.servings,
                      sortOrder: meal.sortOrder,
                    })),
                  }
                : undefined,
            };
          }),
        },
      },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/meal-plans");
    return { data: duplicate, error: null };
  } catch (error) {
    console.error("Duplicate meal plan error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to duplicate meal plan",
    };
  }
}

// ============================================================================
// Add Meal to Day
// ============================================================================

export async function addMealToDay(data: AddMealData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = addMealSchema.parse(data);

    // Verify ownership
    const day = await prisma.mealPlanDay.findUnique({
      where: { id: validatedData.mealPlanDayId },
      include: {
        mealPlan: { select: { userId: true } },
      },
    });

    if (!day) {
      return { data: null, error: "Meal plan day not found" };
    }

    if (day.mealPlan.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Get the next sort order for this meal type
    const existingMeals = await prisma.mealPlanMeal.findMany({
      where: {
        mealPlanDayId: validatedData.mealPlanDayId,
        mealType: validatedData.mealType,
      },
      orderBy: { sortOrder: "desc" },
      take: 1,
    });

    const nextSortOrder =
      existingMeals.length > 0 ? existingMeals[0].sortOrder + 1 : 0;

    // Create meal
    const meal = await prisma.mealPlanMeal.create({
      data: {
        mealPlanDayId: validatedData.mealPlanDayId,
        recipeId: validatedData.recipeId,
        mealType: validatedData.mealType,
        servings: validatedData.servings,
        sortOrder: nextSortOrder,
      },
      include: {
        recipe: true,
      },
    });

    revalidatePath("/meal-plans");
    return { data: meal, error: null };
  } catch (error) {
    console.error("Add meal to day error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to add meal",
    };
  }
}

// ============================================================================
// Remove Meal from Day
// ============================================================================

export async function removeMealFromDay(mealId: string) {
  try {
    const user = await getAuthenticatedUser();

    // Verify ownership
    const meal = await prisma.mealPlanMeal.findUnique({
      where: { id: mealId },
      include: {
        mealPlanDay: {
          include: {
            mealPlan: { select: { userId: true } },
          },
        },
      },
    });

    if (!meal) {
      return { data: null, error: "Meal not found" };
    }

    if (meal.mealPlanDay.mealPlan.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    await prisma.mealPlanMeal.delete({
      where: { id: mealId },
    });

    revalidatePath("/meal-plans");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Remove meal from day error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to remove meal",
    };
  }
}

// ============================================================================
// Move Meal (Drag and Drop)
// ============================================================================

export async function moveMeal(data: MoveMealData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = moveMealSchema.parse(data);

    // Verify ownership
    const meal = await prisma.mealPlanMeal.findUnique({
      where: { id: validatedData.mealId },
      include: {
        mealPlanDay: {
          include: {
            mealPlan: { select: { userId: true } },
          },
        },
      },
    });

    if (!meal) {
      return { data: null, error: "Meal not found" };
    }

    if (meal.mealPlanDay.mealPlan.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Get the next sort order for target meal type
    const existingMeals = await prisma.mealPlanMeal.findMany({
      where: {
        mealPlanDayId: validatedData.targetDayId,
        mealType: validatedData.targetMealType,
      },
      orderBy: { sortOrder: "desc" },
      take: 1,
    });

    const nextSortOrder =
      existingMeals.length > 0 ? existingMeals[0].sortOrder + 1 : 0;

    // Update meal
    const updatedMeal = await prisma.mealPlanMeal.update({
      where: { id: validatedData.mealId },
      data: {
        mealPlanDayId: validatedData.targetDayId,
        mealType: validatedData.targetMealType,
        sortOrder: nextSortOrder,
      },
      include: {
        recipe: true,
      },
    });

    revalidatePath("/meal-plans");
    return { data: updatedMeal, error: null };
  } catch (error) {
    console.error("Move meal error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to move meal",
    };
  }
}

// ============================================================================
// Update Meal Servings
// ============================================================================

export async function updateMealServings(data: UpdateMealServingsData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = updateMealServingsSchema.parse(data);

    // Verify ownership
    const meal = await prisma.mealPlanMeal.findUnique({
      where: { id: validatedData.mealId },
      include: {
        mealPlanDay: {
          include: {
            mealPlan: { select: { userId: true } },
          },
        },
      },
    });

    if (!meal) {
      return { data: null, error: "Meal not found" };
    }

    if (meal.mealPlanDay.mealPlan.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Update servings
    const updatedMeal = await prisma.mealPlanMeal.update({
      where: { id: validatedData.mealId },
      data: { servings: validatedData.servings },
      include: {
        recipe: true,
      },
    });

    revalidatePath("/meal-plans");
    return { data: updatedMeal, error: null };
  } catch (error) {
    console.error("Update meal servings error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update meal servings",
    };
  }
}
