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
import { ALL_NUTRIENT_KEYS, type NutrientKey } from "@/lib/nutrients/registry";
import {
  scoreSwaps,
  type SwapCandidate,
  type SwapSuggestion,
} from "@/lib/nutrients/swap-scorer";
import { generateText } from "ai";
import { getSkeletonModel } from "@/mastra/workflows/_llm";
import {
  assertCanCreateRecipe,
  assertCanUseAiMealPlan,
} from "@/lib/entitlements";
import type { RecipeNutrientProfile } from "@/lib/recipeNutrients";

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

const CANDIDATE_POOL_SIZE = 60;
const MAX_SUGGESTIONS = 5;

const getSwapSuggestionsSchema = z.object({
  mealId: z.string().uuid(),
  nutrient: z.enum(ALL_NUTRIENT_KEYS as [NutrientKey, ...NutrientKey[]]),
  kind: z.enum(["deficit", "excess"]),
});

/** Rank the user's own recipes as replacements for one planned meal. */
export async function getSwapSuggestions(input: {
  mealId: string;
  nutrient: NutrientKey;
  kind: "deficit" | "excess";
}) {
  return serverAction(
    { input: getSwapSuggestionsSchema },
    async (ctx, validated): Promise<SwapSuggestion[]> => {
      const week = await loadWeek(ctx.user.id);
      const meal = week.mealsById.get(validated.mealId);
      if (!meal) throw new Error("Meal not found in your current week");

      const analysis = analyzeWeek(week.days, week.rda);
      const target = analysis.findings.find(
        (f) => f.nutrient === validated.nutrient && f.kind === validated.kind
      );
      if (!target) return [];

      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
        select: { allergies: true },
      });

      const pool = await prisma.recipe.findMany({
        where: { userId: ctx.user.id },
        select: { id: true, ingredients: true },
        orderBy: { updatedAt: "desc" },
        take: CANDIDATE_POOL_SIZE,
      });
      const profiles = await getRecipeNutrientProfiles(
        pool.map((r) => r.id),
        ctx.user.id
      );
      const linesById = new Map(
        pool.map((r) => [r.id, formatIngredientsForNutrition(r.ingredients)])
      );

      const candidates: SwapCandidate[] = [...profiles.values()].map((p) => ({
        recipeId: p.recipeId,
        title: p.title,
        perServing: p.perServing,
        coverage: p.coverage,
        ingredientNames: linesById.get(p.recipeId) ?? [],
      }));

      return scoreSwaps(
        {
          meal,
          target,
          findings: analysis.findings,
          allergies: profile?.allergies ?? [],
        },
        candidates
      ).slice(0, MAX_SUGGESTIONS);
    }
  )(input);
}

const applySwapSchema = z.object({
  mealId: z.string().uuid(),
  newRecipeId: z.string().uuid(),
});

export interface ApplySwapResult {
  /** For one-tap undo: applySwap(mealId, previousRecipeId) */
  previousRecipeId: string;
}

/**
 * Replace the recipe of one planned meal, in place — slot, sortOrder and
 * servings are preserved. Both the meal and the replacement recipe must
 * belong to the caller.
 */
export async function applySwap(input: { mealId: string; newRecipeId: string }) {
  return serverAction(
    {
      input: applySwapSchema,
      revalidates: ["/meal-plans", "/nutrition/my-week"],
    },
    async (ctx, validated): Promise<ApplySwapResult> => {
      const [meal, recipe] = await Promise.all([
        prisma.mealPlanMeal.findUnique({
          where: { id: validated.mealId },
          include: {
            mealPlanDay: { include: { template: { select: { userId: true } } } },
          },
        }),
        prisma.recipe.findUnique({
          where: { id: validated.newRecipeId },
          select: { id: true, userId: true },
        }),
      ]);

      if (!meal || meal.mealPlanDay.template.userId !== ctx.user.id) {
        throw new Error("Meal not found");
      }
      if (!recipe || recipe.userId !== ctx.user.id) {
        throw new Error("Recipe not found");
      }
      if (!meal.recipeId) {
        throw new Error("Meal has no recipe to replace");
      }

      const previousRecipeId = meal.recipeId;
      await prisma.mealPlanMeal.update({
        where: { id: meal.id },
        data: { recipeId: recipe.id, generationFailed: false, generationError: null },
      });

      return { previousRecipeId };
    }
  )(input);
}

const gapRecipeDraftSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  servings: z.coerce.number().int().min(1).max(12),
  ingredients: z
    .array(
      z.object({
        name: z.string(),
        amount: z.coerce.number(),
        unit: z.string(),
      })
    )
    .min(2)
    .max(25),
  instructions: z.array(z.string().min(1)).min(1).max(30),
});

/** Models wrap JSON in fences or prose; cut from first { to last }. */
function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Model response contained no JSON object");
  }
  return text.slice(start, end + 1);
}

const generateGapRecipeSchema = z.object({
  mealId: z.string().uuid(),
  nutrient: z.enum(ALL_NUTRIENT_KEYS as [NutrientKey, ...NutrientKey[]]),
  kind: z.enum(["deficit", "excess"]),
});

export interface GeneratedGapRecipe {
  recipeId: string;
  title: string;
  /** USDA-verified — never the model's own claims */
  profile: RecipeNutrientProfile;
}

/**
 * AI cold-start fallback: draft a recipe targeted at a finding, persist it,
 * verify its nutrition through USDA ingredient matching, and return the
 * verified profile. The user applies it through the normal swap flow.
 */
export async function generateGapRecipe(input: {
  mealId: string;
  nutrient: NutrientKey;
  kind: "deficit" | "excess";
}) {
  return serverAction(
    {
      input: generateGapRecipeSchema,
      requires: async (_input, ctx) => {
        await assertCanUseAiMealPlan(ctx.user);
        await assertCanCreateRecipe(ctx.user);
      },
      revalidates: ["/recipes", "/nutrition/my-week"],
    },
    async (ctx, validated): Promise<GeneratedGapRecipe> => {
      const week = await loadWeek(ctx.user.id);
      const meal = week.mealsById.get(validated.mealId);
      if (!meal) throw new Error("Meal not found in your current week");

      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
        select: { allergies: true, dietaryType: true, cuisinePrefs: true },
      });

      const mealKcal = meal.perServing.kcal;
      const goal =
        validated.kind === "deficit"
          ? `high in ${validated.nutrient}`
          : `low in ${validated.nutrient}`;

      const { text } = await generateText({
        model: getSkeletonModel(),
        prompt: [
          `Create one ${meal.mealType} recipe that is ${goal}.`,
          mealKcal !== undefined
            ? `Target roughly ${Math.round(mealKcal * 0.85)}-${Math.round(mealKcal * 1.15)} kcal per serving.`
            : "",
          profile?.dietaryType?.length
            ? `Dietary style: ${profile.dietaryType.join(", ")}.`
            : "",
          profile?.allergies?.length
            ? `STRICTLY avoid these allergens: ${profile.allergies.join(", ")}.`
            : "",
          profile?.cuisinePrefs?.length
            ? `Preferred cuisines: ${profile.cuisinePrefs.join(", ")}.`
            : "",
          "Use 12 or fewer common whole ingredients with standard units (g, kg, ml, cup, tbsp, tsp, piece).",
          'Respond with ONLY a JSON object, no markdown fences, matching: {"title": string, "description": string, "servings": number, "ingredients": [{"name": string, "amount": number, "unit": string}], "instructions": [string]}',
        ]
          .filter(Boolean)
          .join(" "),
      });

      let draft: z.infer<typeof gapRecipeDraftSchema>;
      try {
        draft = gapRecipeDraftSchema.parse(JSON.parse(extractJsonObject(text)));
      } catch (parseError) {
        console.error(
          "[generateGapRecipe] unparseable model output:",
          text.slice(0, 400),
          parseError
        );
        throw new Error("Generated recipe was malformed");
      }

      const recipe = await prisma.recipe.create({
        data: {
          userId: ctx.user.id,
          title: draft.title,
          description: draft.description ?? null,
          servings: draft.servings,
          ingredients: draft.ingredients,
          instructions: draft.instructions,
          source: "generated",
          tags: ["generated", "nutrition-fix"],
        },
        select: { id: true, ingredients: true, servings: true },
      });

      // Honesty rule: verify with USDA before showing any numbers.
      await persistIngredientMatches(recipe);

      const profiles = await getRecipeNutrientProfiles([recipe.id], ctx.user.id);
      const verified = profiles.get(recipe.id);
      if (!verified) throw new Error("Failed to verify generated recipe");

      return { recipeId: recipe.id, title: verified.title, profile: verified };
    }
  )(input);
}
