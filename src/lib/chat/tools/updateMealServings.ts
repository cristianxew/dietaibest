import { z } from "zod";
import { updateMealServings as updateAction } from "@/actions/meal-plan";
import type { Tool } from "./types";

const inputSchema = z.object({
  mealId: z.string().uuid(),
  servings: z.number().int().min(1).max(20),
});

type UpdateServingsResult = {
  mealId: string;
  servings: number;
};

export const updateMealServings: Tool<
  typeof inputSchema,
  UpdateServingsResult
> = {
  name: "updateMealServings",
  description:
    "Change the servings count for an existing meal in a plan (e.g., scale from 2 servings to 4).",
  inputSchema,
  statusKey: "mealplan.updatingServings",
  requiresFeature: "aiChat",
  async execute(input) {
    const result = await updateAction({
      mealId: input.mealId,
      servings: input.servings,
    });

    if (result.error || !result.data) {
      return {
        ok: false,
        reason: "generic",
        message:
          typeof result.error === "string"
            ? result.error
            : "Failed to update meal servings",
      };
    }

    return {
      ok: true,
      data: {
        mealId: result.data.id,
        servings: result.data.servings,
      },
    };
  },
};
