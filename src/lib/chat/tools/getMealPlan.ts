import { z } from "zod";
import { getMealPlan as getMealPlanAction } from "@/actions/meal-plan";
import type { Tool } from "./types";

const inputSchema = z.object({
  id: z.string().uuid(),
});

type MealSummary = {
  id: string;
  mealType: string;
  servings: number;
  recipeId: string | null;
  recipeName: string | null;
  generationFailed: boolean;
};

type DaySummary = {
  id: string;
  dayNumber: number;
  meals: MealSummary[];
};

type PlanDetail = {
  id: string;
  name: string;
  duration: number;
  days: DaySummary[];
};

export const getMealPlan: Tool<typeof inputSchema, PlanDetail> = {
  name: "getMealPlan",
  description:
    "Fetch a meal plan template by id including its days and meals. Returns the structure suitable for summary.",
  inputSchema,
  statusKey: "mealplan.loading",
  requiresFeature: "aiChat",
  async execute(input) {
    const result = await getMealPlanAction(input.id);

    if (result.error || !result.data) {
      return {
        ok: false,
        reason: "generic",
        message:
          typeof result.error === "string"
            ? result.error
            : "Failed to fetch meal plan",
      };
    }

    const template = result.data;

    const days: DaySummary[] = (template.days ?? []).map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      meals: (day.meals ?? []).map((meal) => ({
        id: meal.id,
        mealType: meal.mealType,
        servings: meal.servings,
        recipeId: meal.recipeId ?? null,
        recipeName: meal.recipe?.title ?? null,
        generationFailed: (meal as { generationFailed?: boolean }).generationFailed ?? false,
      })),
    }));

    return {
      ok: true,
      data: {
        id: template.id,
        name: template.name,
        duration: template.duration,
        days,
      },
      link: {
        type: "mealplan",
        href: `/meal-plans?selected=${template.id}`,
        label: template.name,
      },
    };
  },
};
