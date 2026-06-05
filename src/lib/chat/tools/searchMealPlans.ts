import { z } from "zod";
import { getMealPlans } from "@/actions/meal-plan";
import type { Tool } from "./types";

const inputSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

type PlanSummary = {
  id: string;
  name: string;
  duration: number;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
};

export const searchMealPlans: Tool<
  typeof inputSchema,
  { plans: PlanSummary[] }
> = {
  name: "searchMealPlans",
  description:
    "Search the user's saved meal plans by free-text query. Returns up to limit matches with id, name, duration, and a link to view.",
  inputSchema,
  statusKey: "mealplan.searching",
  requiresFeature: "aiChat",
  async execute(input) {
    const result = await getMealPlans({
      search: input.query,
      limit: input.limit,
      page: 1,
    });

    if (result.error || !result.data) {
      return {
        ok: false,
        reason: "generic",
        message:
          typeof result.error === "string" ? result.error : "Search failed",
      };
    }

    const plans: PlanSummary[] = result.data.templates.map((t) => ({
      id: t.id,
      name: t.name,
      duration: t.duration,
      ...(t.targetCalories != null && { targetCalories: t.targetCalories }),
      ...(t.targetProtein != null && { targetProtein: t.targetProtein }),
      ...(t.targetCarbs != null && { targetCarbs: t.targetCarbs }),
      ...(t.targetFat != null && { targetFat: t.targetFat }),
    }));

    const first = plans[0];

    return {
      ok: true,
      data: { plans },
      ...(first && {
        link: {
          type: "mealplan" as const,
          href: `/meal-plans?selected=${first.id}`,
          label: first.name,
        },
      }),
    };
  },
};
