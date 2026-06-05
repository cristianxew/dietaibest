import { z } from "zod";
import { moveMeal as moveMealAction } from "@/actions/meal-plan";
import { mealTypeEnum } from "@/types/meal-plan";
import type { Tool } from "./types";

const inputSchema = z.object({
  mealId: z.string().uuid(),
  targetMealPlanDayId: z.string().uuid(),
  targetMealType: mealTypeEnum,
  targetSortOrder: z.number().int().min(0).optional(),
});

type MoveMealResult = {
  mealId: string;
  mealType: string;
  dayId: string;
};

export const moveMeal: Tool<typeof inputSchema, MoveMealResult> = {
  name: "moveMeal",
  description:
    "Move an existing meal to a different day and/or meal slot within the same template.",
  inputSchema,
  statusKey: "mealplan.movingMeal",
  requiresFeature: "aiChat",
  async execute(input) {
    // Note: MoveMealData uses `targetDayId`, not `targetMealPlanDayId`.
    // The tool exposes a more descriptive name and maps it here.
    const result = await moveMealAction({
      mealId: input.mealId,
      targetDayId: input.targetMealPlanDayId,
      targetMealType: input.targetMealType,
    });

    if (result.error || !result.data) {
      return {
        ok: false,
        reason: "generic",
        message:
          typeof result.error === "string"
            ? result.error
            : "Failed to move meal",
      };
    }

    const meal = result.data;

    return {
      ok: true,
      data: {
        mealId: meal.id,
        mealType: meal.mealType,
        dayId: meal.mealPlanDayId,
      },
    };
  },
};
