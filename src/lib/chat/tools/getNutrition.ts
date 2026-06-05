import { z } from "zod";
import { analyzeRecipeAction } from "@/actions/analyzeRecipe";
import { getRecipe as getRecipeAction } from "@/actions/recipe";
import { formatIngredientsForNutrition } from "@/lib/ingredients";
import type { Tool } from "./types";

const inputSchema = z.object({
  recipeId: z.string().min(1).optional(),
  ingredients: z.array(z.string().min(1)).min(1).max(50).optional(),
  servings: z.number().int().min(1).default(1),
}).refine(
  (v) => (v.recipeId && !v.ingredients) || (!v.recipeId && v.ingredients),
  { message: "Provide exactly one of recipeId or ingredients" }
);

type PerServing = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

type NutritionData = {
  perServing: PerServing;
  total: PerServing;
  servings: number;
  source: "fdc";
  /**
   * The exact numeric values that the LLM is allowed to surface. The guardrail
   * uses this list to decide whether a number in the prose is tool-grounded.
   * Numbers are rounded to integers for prose comparison; the structured card
   * keeps fractional precision.
   */
  groundedValues: number[];
};

function roundForProse(n: number): number {
  return Math.round(n);
}

function collectGroundedValues(perServing: PerServing, total: PerServing): number[] {
  const candidates = [
    perServing.kcal,
    perServing.protein,
    perServing.carbs,
    perServing.fat,
    perServing.fiber,
    total.kcal,
    total.protein,
    total.carbs,
    total.fat,
    total.fiber,
  ];
  return candidates.map(roundForProse).filter((n) => Number.isFinite(n) && n >= 0);
}

export const getNutrition: Tool<typeof inputSchema, NutritionData> = {
  name: "getNutrition",
  description:
    "Analyze macros (calories, protein, carbs, fat, fiber) for an existing recipe (by recipeId) OR a free-form ingredient list. Returns per-serving and total macros from USDA FDC. This is the ONLY authoritative source of macro numbers — never invent or estimate macros in prose.",
  inputSchema,
  statusKey: "recipe.analyzing",
  requiresFeature: "aiChat",
  async execute(input) {
    let ingredientLines: string[];
    let servings: number;

    if (input.recipeId) {
      const recipe = await getRecipeAction(input.recipeId);
      if (recipe.error || !recipe.data) {
        return {
          ok: false,
          reason: "notFound",
          message: typeof recipe.error === "string" ? recipe.error : "Recipe not found",
        };
      }
      ingredientLines = formatIngredientsForNutrition(recipe.data.ingredients);
      servings = recipe.data.servings;
    } else {
      ingredientLines = input.ingredients!;
      servings = input.servings;
    }

    const analysis = await analyzeRecipeAction({ ingredients: ingredientLines, servings });
    if (!analysis.success) {
      return {
        ok: false,
        reason: "generic",
        message: analysis.error ?? "Analysis failed",
      };
    }

    const perServing: PerServing = {
      kcal: analysis.perServing.kcal,
      protein: analysis.perServing.protein,
      carbs: analysis.perServing.carbs,
      fat: analysis.perServing.fat,
      fiber: analysis.perServing.fiber,
    };
    const total: PerServing = {
      kcal: analysis.total.kcal,
      protein: analysis.total.protein,
      carbs: analysis.total.carbs,
      fat: analysis.total.fat,
      fiber: analysis.total.fiber,
    };

    return {
      ok: true,
      data: {
        perServing,
        total,
        servings,
        source: "fdc",
        groundedValues: collectGroundedValues(perServing, total),
      },
    };
  },
};
