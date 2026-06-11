"use server";

/**
 * "Fix My Week" server actions — thin orchestration over the pure
 * lib/nutrients engines. USDA FDC only: this file must never import
 * from lib/edamam* (per-user macro cache policy).
 */

import { z } from "zod";
import { serverAction } from "@/lib/server-action";
import { prisma } from "@/lib/prisma";
import { analyzeRecipeAction } from "@/actions/analyzeRecipe";
import {
  formatIngredientsForNutrition,
  parseIngredientLine,
} from "@/lib/ingredients";
import { resolveScheduleWindow } from "@/lib/nutrients/schedule-window";
import {
  analyzeWeek,
  type PlannedMealInput,
  type WeekAnalysis,
  type WindowDayInput,
} from "@/lib/nutrients/week-analysis";
import { computeRdaProfile, type RdaProfile } from "@/lib/nutrients/rda";
import { getRecipeNutrientProfiles } from "@/lib/recipeNutrients";
import type { NutrientCoverage } from "@/lib/nutrients/aggregate";

export interface IngredientMatchSummary {
  matched: number;
  total: number;
}

/**
 * Run USDA FDC matching over a recipe's stored ingredients and persist
 * the matches as RecipeIngredient rows (replacing any previous rows).
 * Stored Recipe macros are NOT touched.
 */
async function persistIngredientMatches(recipe: {
  id: string;
  ingredients: unknown;
  servings: number;
}): Promise<IngredientMatchSummary> {
  const lines = formatIngredientsForNutrition(recipe.ingredients).filter(
    (line) => line.trim().length > 0
  );
  if (lines.length === 0) {
    throw new Error("Recipe has no ingredients to analyze");
  }

  const analysis = await analyzeRecipeAction({
    ingredients: lines,
    servings: recipe.servings,
  });
  if (!analysis.success) {
    throw new Error(analysis.error ?? "Ingredient analysis failed");
  }

  const parsed = lines.map(parseIngredientLine);
  const rows = analysis.items.map((item, i) => ({
    recipeId: recipe.id,
    originalText: item.original,
    nameNorm: item.name,
    qty: parsed[i]?.qty ?? 0,
    unit: parsed[i]?.unit ?? "",
    fdcId: item.fdcId,
    gramWeight: item.gramsTotal > 0 ? item.gramsTotal : null,
    confidence: item.confidence,
  }));

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } }),
    prisma.recipeIngredient.createMany({ data: rows }),
  ]);

  return {
    matched: rows.filter((r) => r.fdcId != null).length,
    total: rows.length,
  };
}

const matchRecipeIngredientsSchema = z.object({
  recipeId: z.string().uuid(),
});

/** One-tap data fix: match + persist a recipe's ingredients against USDA. */
export async function matchRecipeIngredients(input: { recipeId: string }) {
  return serverAction(
    {
      input: matchRecipeIngredientsSchema,
      revalidates: ["/nutrition/my-week"],
    },
    async (ctx, validated): Promise<IngredientMatchSummary> => {
      const recipe = await prisma.recipe.findUnique({
        where: { id: validated.recipeId },
        select: { id: true, userId: true, ingredients: true, servings: true },
      });
      if (!recipe || recipe.userId !== ctx.user.id) {
        throw new Error("Recipe not found");
      }
      return persistIngredientMatches(recipe);
    }
  )(input);
}

export interface ImproveDataItem {
  recipeId: string;
  title: string;
  coverage: NutrientCoverage;
}

export interface MyWeekData {
  hasActivePlan: boolean;
  analysis: WeekAnalysis;
  improveData: ImproveDataItem[];
  profileComplete: boolean;
}

interface LoadedWeek {
  days: WindowDayInput[];
  rda: RdaProfile;
  profileComplete: boolean;
  hasActivePlan: boolean;
  /** mealId → meal input, for swap actions */
  mealsById: Map<string, PlannedMealInput>;
  improveData: ImproveDataItem[];
}

/** Shared loader: schedules → window → batched profiles → engine inputs. */
async function loadWeek(userId: string): Promise<LoadedWeek> {
  const [profile, schedules] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.mealPlanSchedule.findMany({
      where: { userId, status: "active" },
      include: {
        template: {
          include: {
            days: {
              include: {
                meals: {
                  where: { recipeId: { not: null } },
                  include: {
                    recipe: { select: { id: true, title: true } },
                  },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const rda = computeRdaProfile({
    dateOfBirth: profile?.dateOfBirth ?? null,
    gender: profile?.gender ?? null,
    weightKg: profile?.weightKg ?? null,
    dailyCalories: profile?.dailyCalories ?? null,
    proteinGrams: profile?.proteinGrams ?? null,
    carbsGrams: profile?.carbsGrams ?? null,
    fatGrams: profile?.fatGrams ?? null,
  });

  const window = resolveScheduleWindow(
    schedules.map((s) => ({
      id: s.id,
      startDate: s.startDate,
      duration: s.template.duration,
    })),
    new Date()
  );

  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const recipeIds = new Set<string>();
  for (const w of window) {
    if (!w.scheduleId || w.dayNumber === null) continue;
    const day = scheduleById
      .get(w.scheduleId)
      ?.template.days.find((d) => d.dayNumber === w.dayNumber);
    for (const m of day?.meals ?? []) {
      if (m.recipe) recipeIds.add(m.recipe.id);
    }
  }

  const profiles = await getRecipeNutrientProfiles([...recipeIds], userId);

  const mealsById = new Map<string, PlannedMealInput>();
  const days: WindowDayInput[] = window.map((w) => {
    if (!w.scheduleId || w.dayNumber === null) {
      return { date: w.date, planned: false, meals: [] };
    }
    const day = scheduleById
      .get(w.scheduleId)
      ?.template.days.find((d) => d.dayNumber === w.dayNumber);
    const meals: PlannedMealInput[] = [];
    for (const m of day?.meals ?? []) {
      const p = m.recipe ? profiles.get(m.recipe.id) : undefined;
      if (!p) continue;
      const input: PlannedMealInput = {
        mealId: m.id,
        recipeId: p.recipeId,
        recipeTitle: p.title,
        mealType: m.mealType,
        servings: m.servings,
        perServing: p.perServing,
        coverage: p.coverage,
      };
      meals.push(input);
      mealsById.set(m.id, input);
    }
    return { date: w.date, planned: true, meals };
  });

  const improveData: ImproveDataItem[] = [...profiles.values()]
    .filter((p) => p.coverage !== "full")
    .map((p) => ({ recipeId: p.recipeId, title: p.title, coverage: p.coverage }));

  return {
    days,
    rda,
    profileComplete: Boolean(profile?.dateOfBirth && profile?.gender),
    hasActivePlan: window.some((w) => w.dayNumber !== null),
    mealsById,
    improveData,
  };
}

/** Analyze the next 7 planned days against the user's personal targets. */
export async function getMyWeekAnalysis() {
  return serverAction({}, async (ctx): Promise<MyWeekData> => {
    const week = await loadWeek(ctx.user.id);
    return {
      hasActivePlan: week.hasActivePlan,
      analysis: analyzeWeek(week.days, week.rda),
      improveData: week.improveData,
      profileComplete: week.profileComplete,
    };
  })(undefined);
}
