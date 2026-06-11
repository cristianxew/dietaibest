/**
 * Batched recipe → nutrient-profile resolution. One prisma query for all
 * recipes, one getFoodsCached call for all distinct fdcIds — rate-limit
 * friendly for week-level analysis (~21 meals).
 *
 * Server-only (imports prisma). USDA FDC only — never Edamam.
 *
 * @module lib/recipeNutrients
 */

import { prisma } from "@/lib/prisma";
import { getFoodsCached } from "@/lib/fdcRepo";
import {
  extractNutrientVector,
  type NutrientVector,
} from "@/lib/nutrients/extract";
import {
  aggregateRecipeNutrients,
  type IngredientContribution,
  type NutrientCoverage,
} from "@/lib/nutrients/aggregate";

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

/**
 * Resolve nutrient profiles for the given recipes (ownership enforced by
 * the userId filter — silently omits recipes the user does not own).
 */
export async function getRecipeNutrientProfiles(
  recipeIds: string[],
  userId: string
): Promise<Map<string, RecipeNutrientProfile>> {
  const result = new Map<string, RecipeNutrientProfile>();
  const distinct = [...new Set(recipeIds)];
  if (distinct.length === 0) return result;

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: distinct }, userId },
    include: { recipeIngredients: true },
  });

  const allFdcIds = new Set<number>();
  for (const recipe of recipes) {
    for (const ri of recipe.recipeIngredients) {
      if (ri.fdcId != null && ri.gramWeight != null && ri.gramWeight > 0) {
        allFdcIds.add(ri.fdcId);
      }
    }
  }
  const foods = await getFoodsCached([...allFdcIds], { profile: "extended" });
  const foodById = new Map(foods.map((f) => [f.fdcId, f]));

  for (const recipe of recipes) {
    const matched = recipe.recipeIngredients.filter(
      (ri) => ri.fdcId != null && ri.gramWeight != null && ri.gramWeight > 0
    );
    const unmatchedCount = recipe.recipeIngredients.length - matched.length;

    const contributions: IngredientContribution[] = [];
    let unresolved = 0;
    for (const ri of matched) {
      const food = foodById.get(ri.fdcId as number);
      if (!food) {
        unresolved++;
        continue;
      }
      contributions.push({
        gramWeight: ri.gramWeight as number,
        vectorPer100g: extractNutrientVector(food),
      });
    }

    const aggregation = aggregateRecipeNutrients(
      contributions,
      unmatchedCount + unresolved,
      recipe.servings
    );

    // No usable FDC matches: fall back to the 5 per-serving macros stored
    // on the Recipe row (covers manual and Edamam-sourced recipes without
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

    result.set(recipe.id, {
      kind: "recipe",
      recipeId: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      imageUrl: recipe.imageUrl ?? null,
      perServing,
      coverage: aggregation.coverage,
      matchedIngredients: aggregation.matchedIngredients,
      totalIngredients: aggregation.totalIngredients,
    });
  }

  return result;
}
