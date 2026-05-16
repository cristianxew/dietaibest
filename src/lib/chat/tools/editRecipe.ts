import { z } from "zod";
import { getRecipe as getRecipeAction, updateRecipe } from "@/actions/recipe";
import { ingredientSchema } from "@/types/recipe";
import type { Tool } from "./types";

const inputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  servings: z.number().int().min(1).optional(),
  ingredients: z.array(ingredientSchema).min(1).optional(),
  instructions: z.array(z.string().min(1)).min(1).optional(),
  tags: z.array(z.string()).optional(),
});

export const editRecipe: Tool<typeof inputSchema, { id: string; title: string }> = {
  name: "editRecipe",
  description:
    "Update specific fields of an existing recipe by id. Only provide the fields the user wants to change — the rest are preserved. Do NOT emit macro numbers; use getNutrition for that.",
  inputSchema,
  statusKey: "recipe.editing",
  requiresFeature: "aiChat",
  async execute(input) {
    const current = await getRecipeAction(input.id);
    if (current.error || !current.data) {
      return {
        ok: false,
        reason: "notFound",
        message: typeof current.error === "string" ? current.error : "Recipe not found",
      };
    }

    const merged = {
      title: input.title ?? current.data.title,
      description: input.description ?? current.data.description ?? undefined,
      servings: input.servings ?? current.data.servings,
      ingredients: (input.ingredients ??
        (current.data.ingredients as z.infer<typeof ingredientSchema>[])) as z.infer<typeof ingredientSchema>[],
      instructions: input.instructions ?? current.data.instructions,
      tags: input.tags ?? current.data.tags,
      categoryIds: current.data.categories.map((c) => c.id),
      isPublic: current.data.isPublic,
      imageUrl: current.data.imageUrl ?? "",
      prepTime: current.data.prepTime ?? undefined,
      cookTime: current.data.cookTime ?? undefined,
      difficulty: (current.data.difficulty ?? undefined) as
        | "easy"
        | "medium"
        | "hard"
        | undefined,
      sourceUrl: current.data.sourceUrl ?? undefined,
      calories: current.data.calories ?? undefined,
      protein: current.data.protein ?? undefined,
      carbs: current.data.carbs ?? undefined,
      fat: current.data.fat ?? undefined,
      fiber: current.data.fiber ?? undefined,
    };

    const result = await updateRecipe(input.id, merged);
    if (result.error || !result.data) {
      return {
        ok: false,
        reason: result.error?.toLowerCase().includes("unauthorized") ? "unauthorized" : "generic",
        message: result.error ?? "Failed to update recipe",
      };
    }

    return {
      ok: true,
      data: { id: result.data.id, title: result.data.title },
      link: {
        type: "recipe",
        href: `/recipes/${result.data.id}`,
        label: result.data.title,
      },
    };
  },
};
