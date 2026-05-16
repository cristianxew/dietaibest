import { z } from "zod";
import { getRecipe as getRecipeAction } from "@/actions/recipe";
import type { Tool } from "./types";

const inputSchema = z.object({
  id: z.string().min(1),
});

type RecipeBrief = {
  id: string;
  title: string;
  description: string | null;
  servings: number;
  ingredients: unknown;
  instructions: string[];
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export const getRecipe: Tool<typeof inputSchema, RecipeBrief> = {
  name: "getRecipe",
  description: "Load one recipe by id. Returns title, servings, ingredients, instructions, and per-recipe macros.",
  inputSchema,
  statusKey: "recipe.loading",
  async execute(input) {
    const result = await getRecipeAction(input.id);
    if (result.error || !result.data) {
      const msg = typeof result.error === "string" ? result.error : "Recipe not found";
      return {
        ok: false,
        reason: msg.toLowerCase().includes("unauthorized") ? "unauthorized" : "notFound",
        message: msg,
      };
    }
    const r = result.data;
    return {
      ok: true,
      data: {
        id: r.id,
        title: r.title,
        description: r.description,
        servings: r.servings,
        ingredients: r.ingredients,
        instructions: r.instructions,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
      },
      link: { type: "recipe", href: `/recipes/${r.id}`, label: r.title },
    };
  },
};
