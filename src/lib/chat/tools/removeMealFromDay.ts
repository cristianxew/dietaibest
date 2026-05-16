import { z } from "zod";
import { removeMealFromDay as removeAction } from "@/actions/meal-plan";
import type { Tool } from "./types";

const inputSchema = z.object({
  mealId: z.string().uuid(),
  reason: z.string().optional(),
  confirmed: z.boolean().optional(),
});

type RemoveMealResult = {
  mealId: string;
};

export const removeMealFromDay: Tool<typeof inputSchema, RemoveMealResult> = {
  name: "removeMealFromDay",
  description:
    "Remove a meal from a day in a plan. The meal row is deleted; the recipe itself is not.",
  inputSchema,
  statusKey: "mealplan.removingMeal",
  requiresFeature: "aiChat",
  async requiresConfirmation(input) {
    if (input.confirmed) return null;
    return {
      message: "Remove this meal from the plan?",
      payload: { mealId: input.mealId, confirmed: true },
    };
  },
  async execute(input) {
    if (!input.confirmed) {
      return {
        ok: false,
        reason: "generic",
        message: "Removal requires confirmation",
      };
    }

    const result = await removeAction(input.mealId);

    if (result.error || !result.data) {
      return {
        ok: false,
        reason: "generic",
        message:
          typeof result.error === "string"
            ? result.error
            : "Failed to remove meal",
      };
    }

    return {
      ok: true,
      data: { mealId: input.mealId },
    };
  },
};
