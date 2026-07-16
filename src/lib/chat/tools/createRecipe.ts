import { z } from "zod";
import { persistRecipe } from "@/actions/recipe";
import { ingredientSchema } from "@/types/recipe";
import type { Tool } from "./types";

const inputSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  servings: z.number().int().min(1).default(2),
  ingredients: z.array(ingredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
  tags: z.array(z.string()).optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
});

export const createRecipe: Tool<typeof inputSchema, { id: string; title: string }> = {
  name: "createRecipe",
  description:
    "Create and save a recipe described in natural language. Provide title, servings, ingredients (with quantities + units), and step-by-step instructions. Nutrition is computed and persisted automatically from USDA FDC; do NOT emit macro numbers.",
  guidance:
    "createRecipe — be coarse-grained: one createRecipe call with the full recipe, not a sequence of granular calls.",
  inputSchema,
  statusKey: "recipe.creating",
  requiresFeature: "aiChat",
  async execute(input, ctx) {
    const result = await persistRecipe(
      {
        ...input,
        tags: input.tags ?? [],
        categoryIds: [],
        isPublic: false,
      },
      { source: "generated", locale: ctx.locale }
    );

    if (result.error || !result.data) {
      if (result.error && typeof result.error === "object" && "code" in result.error) {
        const code = result.error.code;
        return {
          ok: false,
          reason: code === "PRO_ONLY" ? "unauthorized" : "quota",
          message: code === "PRO_ONLY" ? "Pro required" : "Quota exceeded",
        };
      }
      return {
        ok: false,
        reason: "generic",
        message: typeof result.error === "string" ? result.error : "Failed to create recipe",
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
