"use server";

/**
 * Nutrition Hub server actions — thin orchestration over the pure
 * lib/nutrients modules. USDA FDC only: hub code must never import
 * from lib/edamam* (per-user macro cache policy).
 */

import { z } from "zod";
import { serverAction } from "@/lib/server-action";
import { prisma } from "@/lib/prisma";
import { getFoodsCached } from "@/lib/fdcRepo";
import type { FdcFood } from "@/lib/fdc";
import {
  extractNutrientVector,
  type NutrientVector,
} from "@/lib/nutrients/extract";
import {
  aggregateRecipeNutrients,
  type IngredientContribution,
  type NutrientCoverage,
} from "@/lib/nutrients/aggregate";
import { computeRdaProfile, type RdaProfile } from "@/lib/nutrients/rda";

export type ItemRef =
  | { type: "fdc"; id: number }
  | { type: "recipe"; id: string };

export interface FoodPortionOption {
  label: string;
  gramWeight: number;
}

export interface FoodNutrientProfile {
  kind: "food";
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner: string | null;
  /** Nutrients per 100g (sparse — missing key means unknown, not zero) */
  per100g: NutrientVector;
  portions: FoodPortionOption[];
}

export interface RecipeNutrientProfile {
  kind: "recipe";
  recipeId: string;
  title: string;
  servings: number;
  imageUrl: string | null;
  /** Nutrients per serving (sparse — missing key means unknown, not zero) */
  perServing: NutrientVector;
  coverage: NutrientCoverage;
  matchedIngredients: number;
  totalIngredients: number;
}

export type ItemNutrientProfile = FoodNutrientProfile | RecipeNutrientProfile;

const itemRefSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fdc"), id: z.number().int().positive() }),
  z.object({ type: z.literal("recipe"), id: z.string().uuid() }),
]);

const getItemProfilesSchema = z.object({
  items: z.array(itemRefSchema).min(1).max(2),
});

/** Build portion options from FDC foodPortions + branded serving size. */
function buildPortions(food: FdcFood): FoodPortionOption[] {
  const options: FoodPortionOption[] = [];

  for (const p of food.foodPortions ?? []) {
    if (typeof p.gramWeight !== "number" || p.gramWeight <= 0) continue;
    const label = [
      p.portionDescription,
      p.modifier,
      p.measureUnit?.name !== "undetermined" ? p.measureUnit?.name : undefined,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (label) options.push({ label, gramWeight: p.gramWeight });
  }

  const u = (food.servingSizeUnit ?? "").toLowerCase();
  if (
    typeof food.servingSize === "number" &&
    food.servingSize > 0 &&
    (u === "g" || u === "gram" || u === "grams")
  ) {
    options.push({ label: "serving", gramWeight: food.servingSize });
  }

  return options.slice(0, 6);
}

async function buildFoodProfile(fdcId: number): Promise<FoodNutrientProfile> {
  const [food] = await getFoodsCached([fdcId], { profile: "extended" });
  if (!food) throw new Error("Food not found");

  return {
    kind: "food",
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    brandOwner: food.brandOwner ?? null,
    per100g: extractNutrientVector(food),
    portions: buildPortions(food),
  };
}

async function buildRecipeProfile(
  recipeId: string,
  userId: string
): Promise<RecipeNutrientProfile> {
  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    include: { recipeIngredients: true },
  });
  if (!recipe || recipe.userId !== userId) {
    throw new Error("Recipe not found");
  }

  const matched = recipe.recipeIngredients.filter(
    (ri) => ri.fdcId != null && ri.gramWeight != null && ri.gramWeight > 0
  );
  const unmatchedCount = recipe.recipeIngredients.length - matched.length;

  const distinctFdcIds = [...new Set(matched.map((ri) => ri.fdcId as number))];
  const foods = await getFoodsCached(distinctFdcIds, { profile: "extended" });
  const foodById = new Map(foods.map((f) => [f.fdcId, f]));

  const contributions: IngredientContribution[] = [];
  let unresolvedMatches = 0;
  for (const ri of matched) {
    const food = foodById.get(ri.fdcId as number);
    if (!food) {
      unresolvedMatches++;
      continue;
    }
    contributions.push({
      gramWeight: ri.gramWeight as number,
      vectorPer100g: extractNutrientVector(food),
    });
  }

  const aggregation = aggregateRecipeNutrients(
    contributions,
    unmatchedCount + unresolvedMatches,
    recipe.servings
  );

  // No usable FDC matches: fall back to the 5 per-serving macros stored on
  // the Recipe row (covers manual and Edamam-sourced recipes without
  // re-exposing any Edamam detail).
  const perServing: NutrientVector =
    aggregation.coverage === "macrosOnly"
      ? {
          ...(recipe.calories != null && { kcal: recipe.calories }),
          ...(recipe.protein != null && { protein: recipe.protein }),
          ...(recipe.carbs != null && { carbs: recipe.carbs }),
          ...(recipe.fat != null && { fat: recipe.fat }),
          ...(recipe.fiber != null && { fiber: recipe.fiber }),
        }
      : aggregation.perServing;

  return {
    kind: "recipe",
    recipeId: recipe.id,
    title: recipe.title,
    servings: recipe.servings,
    imageUrl: recipe.imageUrl ?? null,
    perServing,
    coverage: aggregation.coverage,
    matchedIngredients: aggregation.matchedIngredients,
    totalIngredients: aggregation.totalIngredients,
  };
}

/**
 * Resolve full nutrient profiles for 1-2 comparison items (foods and/or
 * the user's own recipes). Read-only.
 */
export async function getItemProfiles(input: { items: ItemRef[] }) {
  return serverAction(
    { input: getItemProfilesSchema },
    async (ctx, validated) => {
      return Promise.all(
        validated.items.map((item) =>
          item.type === "fdc"
            ? buildFoodProfile(item.id)
            : buildRecipeProfile(item.id, ctx.user.id)
        )
      );
    }
  )(input);
}

export interface RecipePickerItem {
  id: string;
  title: string;
  servings: number;
  imageUrl: string | null;
}

export interface MyRdaProfile {
  rda: RdaProfile;
  /** True when dateOfBirth + gender are on file (drives the profile nudge) */
  profileComplete: boolean;
}

/** Personalized daily targets from the user's profile (FDA DV fallback). */
export async function getMyRdaProfile() {
  return serverAction({}, async (ctx): Promise<MyRdaProfile> => {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: ctx.user.id },
    });

    const rda = computeRdaProfile({
      dateOfBirth: profile?.dateOfBirth ?? null,
      gender: profile?.gender ?? null,
      weightKg: profile?.weightKg ?? null,
      dailyCalories: profile?.dailyCalories ?? null,
      proteinGrams: profile?.proteinGrams ?? null,
      carbsGrams: profile?.carbsGrams ?? null,
      fatGrams: profile?.fatGrams ?? null,
    });

    return {
      rda,
      profileComplete: Boolean(profile?.dateOfBirth && profile?.gender),
    };
  })(undefined);
}

const searchMyRecipesSchema = z.object({
  query: z.string().trim().min(1).max(100),
});

/** Lightweight recipe search for the hub's item picker (own recipes only). */
export async function searchMyRecipes(input: { query: string }) {
  return serverAction(
    { input: searchMyRecipesSchema },
    async (ctx, validated): Promise<RecipePickerItem[]> => {
      const recipes = await prisma.recipe.findMany({
        where: {
          userId: ctx.user.id,
          title: { contains: validated.query, mode: "insensitive" },
        },
        select: { id: true, title: true, servings: true, imageUrl: true },
        orderBy: { updatedAt: "desc" },
        take: 8,
      });
      return recipes.map((r) => ({ ...r, imageUrl: r.imageUrl ?? null }));
    }
  )(input);
}
