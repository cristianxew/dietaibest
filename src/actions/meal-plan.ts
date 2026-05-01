"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  mealPlanTemplateFormSchema,
  addMealSchema,
  moveMealSchema,
  updateMealServingsSchema,
  type MealPlanTemplateFormData,
  type AddMealData,
  type MoveMealData,
  type UpdateMealServingsData,
  type MealPlanTemplateFilter,
} from "@/types/meal-plan";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { addDays, format } from "date-fns";
import { Prisma } from "@/generated/prisma";
import { assertCanCreateMealPlanTemplate } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";

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

function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

// ============================================================================
// Create Meal Plan Template
// ============================================================================

export async function createMealPlan(data: MealPlanTemplateFormData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = mealPlanTemplateFormSchema.parse(data);
    await assertCanCreateMealPlanTemplate(user, validatedData.duration);

    // If creating from template, get template meals
    let templatePlan = null;
    if (validatedData.templateId) {
      templatePlan = await prisma.mealPlanTemplate.findUnique({
        where: { id: validatedData.templateId },
        include: {
          days: {
            include: {
              meals: true,
            },
            orderBy: { dayNumber: "asc" },
          },
        },
      });

      // Verify ownership of template
      if (
        templatePlan &&
        templatePlan.userId !== user.id &&
        !templatePlan.isPublic
      ) {
        return { data: null, error: "Unauthorized to use this template" };
      }
    }

    // Create meal plan template with days
    const mealPlanTemplate = await prisma.mealPlanTemplate.create({
      data: {
        userId: user.id,
        name: validatedData.name,
        duration: validatedData.duration,
        mealSlots: validatedData.mealSlots,
        targetCalories: validatedData.targetCalories,
        targetProtein: validatedData.targetProtein,
        targetCarbs: validatedData.targetCarbs,
        targetFat: validatedData.targetFat,
        isPublic: validatedData.isPublic,
        shareToken: validatedData.isPublic ? generateShareToken() : null,
        days: {
          create: Array.from({ length: validatedData.duration }, (_, index) => {
            const dayNumber = index + 1;
            // Copy meals from template if available (cycle through if template is shorter)
            const templateDay =
              templatePlan?.days[index % (templatePlan.days.length || 1)];

            return {
              dayNumber,
              meals: templateDay
                ? {
                    create: templateDay.meals.map((meal) => ({
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
          orderBy: { dayNumber: "asc" },
        },
      },
    });

    revalidatePath("/meal-plans");
    return { data: mealPlanTemplate, error: null };
  } catch (error) {
    const entError = toEntitlementError(error);
    if (entError) return { data: null, error: entError };
    console.error("Create meal plan template error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create meal plan template",
    };
  }
}

// ============================================================================
// Update Meal Plan Template
// ============================================================================

export async function updateMealPlan(
  id: string,
  data: MealPlanTemplateFormData
) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = mealPlanTemplateFormSchema.parse(data);

    // Check if user owns the template
    const existingTemplate = await prisma.mealPlanTemplate.findUnique({
      where: { id },
      select: {
        userId: true,
        duration: true,
        shareToken: true,
      },
    });

    if (!existingTemplate) {
      return { data: null, error: "Meal plan template not found" };
    }

    if (existingTemplate.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Handle duration changes
    const durationChanged =
      existingTemplate.duration !== validatedData.duration;

    // Update the template
    const updatedTemplate = await prisma.mealPlanTemplate.update({
      where: { id },
      data: {
        name: validatedData.name,
        duration: validatedData.duration,
        mealSlots: validatedData.mealSlots,
        targetCalories: validatedData.targetCalories,
        targetProtein: validatedData.targetProtein,
        targetCarbs: validatedData.targetCarbs,
        targetFat: validatedData.targetFat,
        isPublic: validatedData.isPublic,
        shareToken:
          validatedData.isPublic && !existingTemplate.shareToken
            ? generateShareToken()
            : existingTemplate.shareToken,
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
          orderBy: { dayNumber: "asc" },
        },
      },
    });

    // If duration changed, adjust days
    if (durationChanged) {
      const currentDayCount = await prisma.mealPlanDay.count({
        where: { templateId: id },
      });

      if (validatedData.duration > currentDayCount) {
        // Add new days
        const newDays = Array.from(
          { length: validatedData.duration - currentDayCount },
          (_, index) => ({
            templateId: id,
            dayNumber: currentDayCount + index + 1,
          })
        );
        await prisma.mealPlanDay.createMany({
          data: newDays,
        });
      } else if (validatedData.duration < currentDayCount) {
        // Remove excess days
        await prisma.mealPlanDay.deleteMany({
          where: {
            templateId: id,
            dayNumber: {
              gt: validatedData.duration,
            },
          },
        });
      }
    }

    revalidatePath("/meal-plans");
    return { data: updatedTemplate, error: null };
  } catch (error) {
    console.error("Update meal plan template error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update meal plan template",
    };
  }
}

// ============================================================================
// Schedule Meal Plan Template
// ============================================================================

export async function scheduleMealPlan(templateId: string, startDate: Date) {
  try {
    const user = await getAuthenticatedUser();

    // Get the template
    const template = await prisma.mealPlanTemplate.findUnique({
      where: { id: templateId },
      select: {
        userId: true,
        duration: true,
        isPublic: true,
      },
    });

    if (!template) {
      return { data: null, error: "Meal plan template not found" };
    }

    // Verify access
    if (template.userId !== user.id && !template.isPublic) {
      return { data: null, error: "Unauthorized to use this template" };
    }

    // Normalize start date
    const normalizedStartDate = new Date(startDate);
    normalizedStartDate.setHours(0, 0, 0, 0);

    // Calculate end date
    const endDate = addDays(normalizedStartDate, template.duration - 1);

    // Check for overlapping schedules
    const overlappingSchedule = await prisma.mealPlanSchedule.findFirst({
      where: {
        userId: user.id,
        status: "active",
        OR: [
          {
            AND: [
              { startDate: { lte: normalizedStartDate } },
              { template: { duration: { gte: 1 } } }, // Has duration
            ],
          },
        ],
      },
      include: {
        template: {
          select: {
            duration: true,
          },
        },
      },
    });

    if (overlappingSchedule) {
      // Check if dates actually overlap
      const overlappingEndDate = addDays(
        overlappingSchedule.startDate,
        overlappingSchedule.template.duration - 1
      );

      if (
        (normalizedStartDate >= overlappingSchedule.startDate &&
          normalizedStartDate <= overlappingEndDate) ||
        (endDate >= overlappingSchedule.startDate &&
          endDate <= overlappingEndDate) ||
        (normalizedStartDate <= overlappingSchedule.startDate &&
          endDate >= overlappingEndDate)
      ) {
        return {
          data: null,
          error: `Schedule conflicts with an existing plan from ${format(
            overlappingSchedule.startDate,
            "MMM d"
          )} to ${format(overlappingEndDate, "MMM d")}`,
        };
      }
    }

    // Create the schedule
    const schedule = await prisma.mealPlanSchedule.create({
      data: {
        templateId,
        userId: user.id,
        startDate: normalizedStartDate,
        status: "active",
      },
      include: {
        template: {
          include: {
            days: {
              include: {
                meals: {
                  include: {
                    recipe: true,
                  },
                },
              },
              orderBy: { dayNumber: "asc" },
            },
          },
        },
      },
    });

    revalidatePath("/meal-plans");
    return { data: schedule, error: null };
  } catch (error) {
    console.error("Schedule meal plan error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to schedule meal plan",
    };
  }
}

// ============================================================================
// Unschedule Meal Plan
// ============================================================================

export async function unscheduleMealPlan(scheduleId: string) {
  try {
    const user = await getAuthenticatedUser();

    // Check ownership
    const schedule = await prisma.mealPlanSchedule.findUnique({
      where: { id: scheduleId },
      select: { userId: true },
    });

    if (!schedule) {
      return { data: null, error: "Schedule not found" };
    }

    if (schedule.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Delete the schedule (template remains intact)
    await prisma.mealPlanSchedule.delete({
      where: { id: scheduleId },
    });

    revalidatePath("/meal-plans");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Unschedule meal plan error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to unschedule meal plan",
    };
  }
}

// ============================================================================
// Delete Meal Plan Template
// ============================================================================

export async function deleteMealPlan(id: string) {
  try {
    const user = await getAuthenticatedUser();

    // Check ownership
    const template = await prisma.mealPlanTemplate.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!template) {
      return { data: null, error: "Meal plan template not found" };
    }

    if (template.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Delete template (cascades to days, meals, and schedules)
    await prisma.mealPlanTemplate.delete({
      where: { id },
    });

    revalidatePath("/meal-plans");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Delete meal plan template error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to delete meal plan template",
    };
  }
}

// ============================================================================
// Clear Scheduled Plans (Legacy - now just cancels old schedules)
// ============================================================================

export async function clearScheduledPlans() {
  try {
    const user = await getAuthenticatedUser();

    // Cancel all completed schedules
    await prisma.mealPlanSchedule.updateMany({
      where: {
        userId: user.id,
        status: "completed",
      },
      data: {
        status: "cancelled",
      },
    });

    revalidatePath("/meal-plans");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Clear scheduled plans error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to clear scheduled plans",
    };
  }
}

// ============================================================================
// Get Meal Plan Templates
// ============================================================================

export async function getMealPlans(filter?: MealPlanTemplateFilter) {
  try {
    const user = await getAuthenticatedUser();
    const {
      search,
      duration,
      isPublic,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 12,
    } = filter || {};

    const where: Prisma.MealPlanTemplateWhereInput = {
      userId: user.id,
      ...(search && {
        name: {
          contains: search,
          mode: "insensitive" as Prisma.QueryMode,
        },
      }),
      ...(duration !== undefined && { duration }),
      ...(isPublic !== undefined && { isPublic }),
    };

    const [templates, total] = await Promise.all([
      prisma.mealPlanTemplate.findMany({
        where,
        include: {
          days: {
            include: {
              meals: {
                include: {
                  recipe: true,
                },
              },
            },
            orderBy: { dayNumber: "asc" },
          },
          schedules: {
            where: {
              status: "active",
            },
            orderBy: {
              startDate: "asc",
            },
            take: 5, // Show up to 5 active schedules
          },
          _count: {
            select: {
              schedules: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.mealPlanTemplate.count({ where }),
    ]);

    revalidatePath("/meal-plans");
    return {
      data: {
        templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("Get meal plan templates error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch meal plan templates",
    };
  }
}

// ============================================================================
// Get Single Meal Plan Template
// ============================================================================

export async function getMealPlan(id: string) {
  try {
    const user = await getAuthenticatedUser();

    const template = await prisma.mealPlanTemplate.findUnique({
      where: { id },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: true,
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { dayNumber: "asc" },
        },
        schedules: {
          where: {
            userId: user.id,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    });

    if (!template) {
      return { data: null, error: "Meal plan template not found" };
    }

    // Check access
    if (template.userId !== user.id && !template.isPublic) {
      return { data: null, error: "Unauthorized" };
    }

    return { data: template, error: null };
  } catch (error) {
    console.error("Get meal plan template error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch meal plan template",
    };
  }
}

// ============================================================================
// Get Meal Plan Template by Share Token
// ============================================================================

export async function getMealPlanByShareToken(shareToken: string) {
  try {
    const template = await prisma.mealPlanTemplate.findUnique({
      where: { shareToken, isPublic: true },
      include: {
        days: {
          include: {
            meals: {
              include: {
                recipe: {
                  select: {
                    id: true,
                    title: true,
                    imageUrl: true,
                    description: true,
                    prepTime: true,
                    cookTime: true,
                    servings: true,
                    calories: true,
                    protein: true,
                    carbs: true,
                    fat: true,
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { dayNumber: "asc" },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!template) {
      return {
        data: null,
        error: "Meal plan template not found or not public",
      };
    }

    return { data: template, error: null };
  } catch (error) {
    console.error("Get meal plan template by share token error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch meal plan template",
    };
  }
}

// ============================================================================
// Duplicate Meal Plan Template
// ============================================================================

export async function duplicateMealPlan(id: string, newName?: string) {
  try {
    const user = await getAuthenticatedUser();

    // Get the template to duplicate
    const sourceTemplate = await prisma.mealPlanTemplate.findUnique({
      where: { id },
      include: {
        days: {
          include: {
            meals: true,
          },
          orderBy: { dayNumber: "asc" },
        },
      },
    });

    if (!sourceTemplate) {
      return { data: null, error: "Meal plan template not found" };
    }

    // Check access
    if (sourceTemplate.userId !== user.id && !sourceTemplate.isPublic) {
      return { data: null, error: "Unauthorized" };
    }

    // Create duplicate
    const duplicatedTemplate = await prisma.mealPlanTemplate.create({
      data: {
        userId: user.id,
        name: newName || `${sourceTemplate.name} (Copy)`,
        duration: sourceTemplate.duration,
        mealSlots: sourceTemplate.mealSlots,
        targetCalories: sourceTemplate.targetCalories,
        targetProtein: sourceTemplate.targetProtein,
        targetCarbs: sourceTemplate.targetCarbs,
        targetFat: sourceTemplate.targetFat,
        isPublic: false, // Copies are private by default
        days: {
          create: sourceTemplate.days.map((day) => ({
            dayNumber: day.dayNumber,
            meals: {
              create: day.meals.map((meal) => ({
                recipeId: meal.recipeId,
                mealType: meal.mealType,
                servings: meal.servings,
                sortOrder: meal.sortOrder,
              })),
            },
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
          orderBy: { dayNumber: "asc" },
        },
      },
    });

    revalidatePath("/meal-plans");
    return { data: duplicatedTemplate, error: null };
  } catch (error) {
    console.error("Duplicate meal plan template error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to duplicate meal plan template",
    };
  }
}

// ============================================================================
// Meal Management Functions (these remain largely unchanged)
// ============================================================================

export async function addMealToDay(data: AddMealData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = addMealSchema.parse(data);

    // Verify day belongs to user's template
    const day = await prisma.mealPlanDay.findUnique({
      where: { id: validatedData.mealPlanDayId },
      include: {
        template: {
          select: { userId: true },
        },
      },
    });

    if (!day) {
      return { data: null, error: "Meal plan day not found" };
    }

    if (day.template.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Get next sort order
    const existingMeals = await prisma.mealPlanMeal.findMany({
      where: {
        mealPlanDayId: validatedData.mealPlanDayId,
        mealType: validatedData.mealType,
      },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
      take: 1,
    });

    const nextSortOrder =
      existingMeals.length > 0 ? existingMeals[0].sortOrder + 1 : 0;

    // Add meal
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

export async function removeMealFromDay(mealId: string) {
  try {
    const user = await getAuthenticatedUser();

    // Verify meal belongs to user's template
    const meal = await prisma.mealPlanMeal.findUnique({
      where: { id: mealId },
      include: {
        mealPlanDay: {
          include: {
            template: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!meal) {
      return { data: null, error: "Meal not found" };
    }

    if (meal.mealPlanDay.template.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Delete meal
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

export async function moveMeal(data: MoveMealData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = moveMealSchema.parse(data);

    // Verify meal belongs to user's template
    const meal = await prisma.mealPlanMeal.findUnique({
      where: { id: validatedData.mealId },
      include: {
        mealPlanDay: {
          include: {
            template: {
              select: { userId: true, id: true },
            },
          },
        },
      },
    });

    if (!meal) {
      return { data: null, error: "Meal not found" };
    }

    if (meal.mealPlanDay.template.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    // Verify target day belongs to same template
    const targetDay = await prisma.mealPlanDay.findUnique({
      where: { id: validatedData.targetDayId },
      select: { templateId: true },
    });

    if (!targetDay || targetDay.templateId !== meal.mealPlanDay.template.id) {
      return {
        data: null,
        error: "Target day not found or belongs to different template",
      };
    }

    // Get next sort order in target slot
    const existingMeals = await prisma.mealPlanMeal.findMany({
      where: {
        mealPlanDayId: validatedData.targetDayId,
        mealType: validatedData.targetMealType,
      },
      select: { sortOrder: true },
      orderBy: { sortOrder: "desc" },
      take: 1,
    });

    const nextSortOrder =
      existingMeals.length > 0 ? existingMeals[0].sortOrder + 1 : 0;

    // Move meal
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

export async function updateMealServings(data: UpdateMealServingsData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = updateMealServingsSchema.parse(data);

    // Verify meal belongs to user's template
    const meal = await prisma.mealPlanMeal.findUnique({
      where: { id: validatedData.mealId },
      include: {
        mealPlanDay: {
          include: {
            template: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!meal) {
      return { data: null, error: "Meal not found" };
    }

    if (meal.mealPlanDay.template.userId !== user.id) {
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

// Legacy function name (deprecated but kept for backwards compatibility)
export async function overwriteActivePlan(templateId: string, startDate: Date) {
  // Just schedule the template as active
  return scheduleMealPlan(templateId, startDate);
}

// ============================================================================
// Get Active Meal Plan Schedule (for Dashboard)
// ============================================================================

export async function getActiveMealPlanSchedule() {
  try {
    const user = await getAuthenticatedUser();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find active schedule that covers today
    const activeSchedule = await prisma.mealPlanSchedule.findFirst({
      where: {
        userId: user.id,
        status: "active",
      },
      include: {
        template: {
          include: {
            days: {
              include: {
                meals: {
                  include: { recipe: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
              orderBy: { dayNumber: "asc" },
            },
          },
        },
      },
      orderBy: { startDate: "desc" },
    });

    if (!activeSchedule) {
      return { data: null, error: null };
    }

    // Calculate current day number in the plan
    const startDate = new Date(activeSchedule.startDate);
    startDate.setHours(0, 0, 0, 0);
    const daysSinceStart = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if we're still within the plan duration
    if (daysSinceStart >= activeSchedule.template.duration) {
      // Plan has ended, mark as completed
      await prisma.mealPlanSchedule.update({
        where: { id: activeSchedule.id },
        data: { status: "completed" },
      });
      return { data: null, error: null };
    }

    const currentDayNumber = daysSinceStart + 1;
    const currentDay = activeSchedule.template.days.find(
      (d) => d.dayNumber === currentDayNumber
    );

    return {
      data: {
        id: activeSchedule.id,
        templateId: activeSchedule.templateId,
        templateName: activeSchedule.template.name,
        startDate: activeSchedule.startDate,
        duration: activeSchedule.template.duration,
        currentDayNumber,
        daysRemaining: activeSchedule.template.duration - currentDayNumber,
        todaysMeals: currentDay?.meals || [],
        template: activeSchedule.template,
        mealSlots: activeSchedule.template.mealSlots,
        targetCalories: activeSchedule.template.targetCalories,
        targetProtein: activeSchedule.template.targetProtein,
        targetCarbs: activeSchedule.template.targetCarbs,
        targetFat: activeSchedule.template.targetFat,
      },
      error: null,
    };
  } catch (error) {
    console.error("Get active meal plan schedule error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get active meal plan schedule",
    };
  }
}

// ============================================================================
// Get Meal Plan Stats (for Dashboard)
// ============================================================================

export async function getMealPlanStats() {
  try {
    const user = await getAuthenticatedUser();

    const [totalTemplates, activeSchedules] = await Promise.all([
      prisma.mealPlanTemplate.count({
        where: { userId: user.id },
      }),
      prisma.mealPlanSchedule.count({
        where: {
          userId: user.id,
          status: "active",
        },
      }),
    ]);

    return {
      data: {
        totalTemplates,
        activeSchedules,
      },
      error: null,
    };
  } catch (error) {
    console.error("Get meal plan stats error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get meal plan stats",
    };
  }
}
