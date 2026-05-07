import prisma from "@/lib/prisma";
import {
  analyzeRecipeNutrition,
  saveUserMacroCache,
  type RecipeNutritionInput,
  type NutritionAnalysisResult,
} from "@/lib/edamam-service";
import { formatIngredientsForNutrition } from "@/lib/ingredients";
import type { Recipe } from "@/generated/prisma";

export type NutritionApplyOutcome =
  | {
      kind: "applied";
      recipe: Recipe;
      macros: NutritionAnalysisResult["macros"];
      nutrition: NutritionAnalysisResult;
    }
  | { kind: "noop"; reason: "no-ingredients" }
  | { kind: "failed"; reason: string };

export interface ApplyNutritionOptions {
  forceRefresh?: boolean;
  locale?: "en" | "es" | "pl";
}

/**
 * Derive nutrition from a Recipe's canonical ingredients and apply it
 * idempotently: update the recipe row's macros, save the user macro cache,
 * return the outcome. Failures never throw — callers decide whether to
 * surface them.
 */
export async function applyNutritionToRecipe(
  recipe: Recipe,
  userId: string,
  options: ApplyNutritionOptions = {},
): Promise<NutritionApplyOutcome> {
  const ingredientLines = formatIngredientsForNutrition(recipe.ingredients);

  if (ingredientLines.length === 0) {
    return { kind: "noop", reason: "no-ingredients" };
  }

  const input: RecipeNutritionInput = {
    title: recipe.title,
    ingredients: ingredientLines,
    servings: recipe.servings,
    url: recipe.sourceUrl || undefined,
    instructions: recipe.instructions,
  };

  let nutrition: NutritionAnalysisResult;
  try {
    const result = await analyzeRecipeNutrition(input, userId, options);
    if ("error" in result) {
      return { kind: "failed", reason: result.error };
    }
    nutrition = result;
  } catch (error) {
    return {
      kind: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  let updatedRecipe: Recipe;
  try {
    updatedRecipe = await prisma.recipe.update({
      where: { id: recipe.id },
      data: {
        calories: nutrition.macros.calories,
        protein: nutrition.macros.protein,
        carbs: nutrition.macros.netCarbs,
        fat: nutrition.macros.fat,
        updatedAt: new Date(),
      },
    });
    await saveUserMacroCache(
      userId,
      recipe.id,
      nutrition.macros,
      nutrition.servings,
    );
  } catch (error) {
    return {
      kind: "failed",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  return { 
    kind: "applied",
    recipe: updatedRecipe,
    macros: nutrition.macros,
    nutrition,
  };
}
