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
import { computeRdaProfile, type RdaProfile } from "@/lib/nutrients/rda";
import {
  getRecipeNutrientProfiles,
  type RecipeNutrientProfile,
} from "@/lib/recipeNutrients";

export type { RecipeNutrientProfile };

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
  const profiles = await getRecipeNutrientProfiles([recipeId], userId);
  const profile = profiles.get(recipeId);
  if (!profile) throw new Error("Recipe not found");
  return profile;
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
