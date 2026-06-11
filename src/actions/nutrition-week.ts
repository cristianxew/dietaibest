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
