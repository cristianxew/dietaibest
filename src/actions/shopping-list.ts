"use server";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  generateShoppingListSchema,
  type ShoppingListResult,
  type ShoppingListIngredient,
  type ShoppingListRecipe,
} from "@/types/shopping-list";
import type { Ingredient } from "@/types/recipe";
import { categorizeIngredient } from "@/lib/ingredient-categories";
import {
  normalizeUnit,
  applySynonyms,
  stripStateWords,
} from "@/lib/ingredients";
import { addDays, isWithinInterval, startOfDay, endOfDay } from "date-fns";

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

/**
 * Parse ingredient JSON from recipe
 */
function parseIngredients(ingredientsJson: unknown): Ingredient[] {
  if (Array.isArray(ingredientsJson)) {
    return ingredientsJson as Ingredient[];
  }
  if (typeof ingredientsJson === "string") {
    try {
      return JSON.parse(ingredientsJson);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Normalize ingredient name for consolidation
 */
function normalizeIngredientName(name: string): string {
  let normalized = name.toLowerCase().trim();
  normalized = stripStateWords(normalized);
  normalized = applySynonyms(normalized);
  return normalized;
}

/**
 * Intermediate structure for collecting ingredients before consolidation
 */
interface CollectedIngredient {
  originalName: string;
  amount: number;
  unit: string;
  recipeId: string;
}

/**
 * Consolidate ingredients WITHOUT unit conversion
 * Groups by normalized name + normalized unit, sums amounts
 * This ensures CategoryView and RecipeView show same units
 */
function consolidateIngredients(
  collected: CollectedIngredient[]
): ShoppingListIngredient[] {
  // Group by normalized name + normalized unit
  const groups = new Map<
    string,
    {
      normalizedName: string;
      normalizedUnit: string;
      amount: number;
      originalNames: Set<string>;
      recipeIds: Set<string>;
    }
  >();

  for (const item of collected) {
    const normalizedName = normalizeIngredientName(item.originalName);
    const normalizedUnit = normalizeUnit(item.unit);
    const key = `${normalizedName}_${normalizedUnit}`;

    if (!groups.has(key)) {
      groups.set(key, {
        normalizedName,
        normalizedUnit,
        amount: 0,
        originalNames: new Set(),
        recipeIds: new Set(),
      });
    }

    const group = groups.get(key)!;
    group.amount += item.amount;
    group.originalNames.add(item.originalName);
    group.recipeIds.add(item.recipeId);
  }

  const result: ShoppingListIngredient[] = [];

  for (const [id, group] of groups) {
    result.push({
      id,
      name: group.normalizedName,
      originalNames: Array.from(group.originalNames),
      amount: formatAmount(group.amount),
      unit: group.normalizedUnit,
      baseAmount: formatAmount(group.amount), // No conversion, base = display
      baseUnit: group.normalizedUnit,
      category: categorizeIngredient(group.normalizedName),
      recipeIds: Array.from(group.recipeIds),
    });
  }

  return result;
}

/**
 * Format amount to clean display (e.g., 1.5 instead of 1.500000001)
 */
function formatAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// ============================================================================
// Main Server Action
// ============================================================================

export async function generateShoppingList(
  startDate: Date,
  endDate: Date
): Promise<{ data: ShoppingListResult | null; error: string | null }> {
  try {
    const user = await getAuthenticatedUser();

    // Validate inputs
    const validation = generateShoppingListSchema.safeParse({
      startDate,
      endDate,
    });
    if (!validation.success) {
      return { data: null, error: "Invalid date range" };
    }

    // Normalize dates
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    // Fetch all active schedules for the user
    const schedules = await prisma.mealPlanSchedule.findMany({
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
                  include: {
                    recipe: {
                      select: {
                        id: true,
                        title: true,
                        imageUrl: true,
                        servings: true,
                        ingredients: true,
                      },
                    },
                  },
                },
              },
              orderBy: { dayNumber: "asc" },
            },
          },
        },
      },
    });

    // Collections for consolidation
    const collectedIngredients: CollectedIngredient[] = [];
    const recipeMap = new Map<string, ShoppingListRecipe>();
    const schedulesIncluded: string[] = [];
    let totalMeals = 0;

    for (const schedule of schedules) {
      const scheduleStart = startOfDay(schedule.startDate);
      const scheduleEnd = addDays(scheduleStart, schedule.template.duration - 1);

      // Check if schedule overlaps with requested range
      const overlaps = scheduleStart <= end && scheduleEnd >= start;

      if (!overlaps) continue;

      schedulesIncluded.push(schedule.id);

      // Process each day in the template
      for (const day of schedule.template.days) {
        const dayDate = addDays(scheduleStart, day.dayNumber - 1);

        // Check if this specific day falls within the requested range
        if (!isWithinInterval(dayDate, { start, end })) {
          continue;
        }

        // Process each meal in the day
        for (const meal of day.meals) {
          totalMeals++;
          const recipe = meal.recipe;
          // Skip slots without a resolved recipe (DIE-37 partial-fail rows).
          if (!recipe) continue;
          const ingredients = parseIngredients(recipe.ingredients);
          const mealServings = meal.servings;
          const recipeServings = recipe.servings;
          const servingsMultiplier = mealServings / recipeServings;

          // Add/update recipe in recipeMap
          if (!recipeMap.has(recipe.id)) {
            recipeMap.set(recipe.id, {
              id: recipe.id,
              title: recipe.title,
              imageUrl: recipe.imageUrl,
              originalServings: recipeServings,
              scheduledServings: mealServings,
              ingredients: ingredients.map((ing) => {
                const normalizedName = normalizeIngredientName(ing.name);
                const normalizedUnit = normalizeUnit(ing.unit ?? "");
                // Simple ID: name_unit (matches consolidated ingredients)
                const ingredientId = `${normalizedName}_${normalizedUnit}`;
                const adjustedAmount = ing.amount * servingsMultiplier;

                return {
                  id: ingredientId,
                  name: ing.name,
                  amount: formatAmount(adjustedAmount),
                  unit: normalizedUnit, // Use normalized unit for consistency
                  originalAmount: ing.amount,
                  baseAmount: formatAmount(adjustedAmount), // No conversion
                  baseUnit: normalizedUnit,
                };
              }),
            });
          } else {
            // Recipe appears multiple times - add servings
            const existing = recipeMap.get(recipe.id)!;
            existing.scheduledServings += mealServings;

            // Update ingredient amounts AND baseAmounts
            for (const existingIng of existing.ingredients) {
              const matchingIng = ingredients.find(
                (i) =>
                  normalizeIngredientName(i.name) ===
                  normalizeIngredientName(existingIng.name)
              );
              if (matchingIng) {
                const additionalAmount = matchingIng.amount * servingsMultiplier;
                existingIng.amount = formatAmount(
                  existingIng.amount + additionalAmount
                );
                // IMPORTANT: Also update baseAmount!
                existingIng.baseAmount = formatAmount(
                  existingIng.baseAmount + additionalAmount
                );
              }
            }
          }

          // Collect ingredients for consolidation
          for (const ing of ingredients) {
            const adjustedAmount = ing.amount * servingsMultiplier;
            collectedIngredients.push({
              originalName: ing.name,
              amount: adjustedAmount,
              unit: ing.unit ?? "",
              recipeId: recipe.id,
            });
          }
        }
      }
    }

    // Consolidate ingredients with unit conversion
    const consolidatedIngredients =
      consolidateIngredients(collectedIngredients);

    const result: ShoppingListResult = {
      ingredients: consolidatedIngredients,
      recipes: Array.from(recipeMap.values()),
      dateRange: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      metadata: {
        totalRecipes: recipeMap.size,
        totalMeals,
        schedulesIncluded,
      },
    };

    return { data: result, error: null };
  } catch (error) {
    console.error("Generate shopping list error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate shopping list",
    };
  }
}
