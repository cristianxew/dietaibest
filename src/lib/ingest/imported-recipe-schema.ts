import { z } from "zod";

import { ingredientSchema, recipeDifficultyEnum } from "@/types/recipe";

// DIE-41 — Zod schema that mirrors the ImportedRecipe interface used by every
// extraction pipeline (URL via Supadata, image via Gemma 4, future PDF/audio).
// This is the schema we constrain Gemma's structured output against via
// generateObject(); it is intentionally MORE LENIENT than `recipeFormSchema`
// because LLM extractors emit partial/noisy data:
//   - title only requires 1 char (no min-3 yet — tool callers enforce that)
//   - ingredients can be empty (tool returns reason="no-ingredients" instead
//     of a generic Zod failure so the FE shows the right error)
//   - instructions can be empty (tool fills a placeholder if absent)
//   - imageUrl accepts any string (not z.string().url()) — Gemma may emit
//     descriptions or empty strings; we filter at mapping time.
//
// On the consumer side (importRecipeFromImage tool), we map this shape into
// `recipeFormSchema` shape with sensible defaults before calling persistRecipe.

export const importedRecipeSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  difficulty: recipeDifficultyEnum.optional(),
  ingredients: z.array(ingredientSchema),
  instructions: z.array(z.string()),
  imageUrl: z.string().optional(),
  tags: z.array(z.string()).optional(),
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  sugar: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  cuisine: z.string().optional(),
  sourceUrl: z.string().optional(),
  extractedAt: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export type ImportedRecipeData = z.infer<typeof importedRecipeSchema>;
