import { z } from "zod";
import { addMealToDay as addMealAction } from "@/actions/meal-plan";
import { mealTypeEnum } from "@/types/meal-plan";
import type { Tool } from "./types";

const inputSchema = z.object({
  mealPlanDayId: z.string().uuid(),
  recipeId: z.string().uuid(),
  mealType: mealTypeEnum,
  servings: z.number().int().min(1).max(20).default(1),
});

type AddMealResult = {
  mealId: string;
  recipeId: string;
  recipeName: string | null;
  mealType: string;
  servings: number;
};

export const addMealToDay: Tool<typeof inputSchema, AddMealResult> = {
  name: "addMealToDay",
  description: "Add a recipe to a specific day and meal slot in a meal plan.",
  inputSchema,
  statusKey: "mealplan.addingMeal",
  requiresFeature: "aiChat",
  async execute(input) {
    const result = await addMealAction({
      mealPlanDayId: input.mealPlanDayId,
      recipeId: input.recipeId,
      mealType: input.mealType,
      servings: input.servings,
    });

    if (result.error || !result.data) {
      return {
        ok: false,
        reason: "generic",
        message:
          typeof result.error === "string"
            ? result.error
            : "Failed to add meal",
      };
    }

    const meal = result.data;

    return {
      ok: true,
      data: {
        mealId: meal.id,
        recipeId: meal.recipeId ?? input.recipeId,
        recipeName: meal.recipe?.title ?? null,
        mealType: meal.mealType,
        servings: meal.servings,
      },
    };
  },
};
