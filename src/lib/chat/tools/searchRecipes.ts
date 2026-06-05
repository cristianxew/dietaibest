import { z } from "zod";
import { getRecipes } from "@/actions/recipe";
import type { Tool } from "./types";

const inputSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  favoritesOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).default(8),
});

export const searchRecipes: Tool<typeof inputSchema, { recipes: Array<{ id: string; title: string; description: string | null }> }> = {
  name: "searchRecipes",
  description:
    "Search the user's saved recipes by free-text query and/or favorites filter. Returns up to `limit` matches with id and title.",
  inputSchema,
  statusKey: "recipe.searching",
  async execute(input) {
    const result = await getRecipes({
      search: input.query,
      favorites: input.favoritesOnly,
      page: 1,
      limit: input.limit,
    });

    if (result.error || !result.data) {
      return {
        ok: false,
        reason: "generic",
        message: typeof result.error === "string" ? result.error : "Search failed",
      };
    }

    return {
      ok: true,
      data: {
        recipes: result.data.recipes.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
        })),
      },
    };
  },
};
