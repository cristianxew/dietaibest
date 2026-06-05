import { z } from "zod";
import { deleteRecipe as deleteRecipeAction, getRecipe as getRecipeAction } from "@/actions/recipe";
import type { Tool } from "./types";

const inputSchema = z.object({
  id: z.string().min(1),
  confirmed: z.boolean().optional(),
});

export const deleteRecipe: Tool<typeof inputSchema, { id: string; deleted: true }> = {
  name: "deleteRecipe",
  description:
    "Delete a recipe by id. DESTRUCTIVE — the runtime will ask the user to confirm before this runs. Pass {id} the first time; the runtime adds {confirmed: true} after the user accepts.",
  inputSchema,
  statusKey: "recipe.deleting",
  requiresFeature: "aiChat",
  async requiresConfirmation(input) {
    if (input.confirmed) return null;
    const r = await getRecipeAction(input.id);
    const name = r.data?.title ?? "this recipe";
    return {
      message: name,
      payload: { id: input.id, confirmed: true },
    };
  },
  async execute(input) {
    if (!input.confirmed) {
      return {
        ok: false,
        reason: "generic",
        message: "Delete requires confirmation",
      };
    }
    const result = await deleteRecipeAction(input.id);
    if (result.error || !result.data) {
      return {
        ok: false,
        reason: result.error?.toLowerCase().includes("unauthorized") ? "unauthorized" : "generic",
        message: result.error ?? "Failed to delete recipe",
      };
    }
    return { ok: true, data: { id: input.id, deleted: true } };
  },
};
