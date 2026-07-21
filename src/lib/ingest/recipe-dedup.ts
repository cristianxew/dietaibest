import "server-only";

/**
 * Import-dedup lookup shared by the two URL entry points (the modal route
 * `/api/recipes/import/url` and the chat tool `importRecipeFromUrl`).
 *
 * Semantics (cross-user COPY model):
 * - "own"   → this user already imported the canonical URL; callers return the
 *             existing recipe instead of creating anything.
 * - "other" → someone else imported it; callers serve its content as the
 *             preview (skipping Supadata/Gemma) and `persistRecipe` may copy
 *             its nutrition via `dedupSourceRecipeId`. The importer still gets
 *             their OWN row — recipes are never shared across users.
 */

import type { Recipe } from "@/generated/prisma";

import prisma from "@/lib/prisma";
import { parseIngredientLine } from "@/lib/ingredients";
import {
  recipeDifficultyEnum,
  type ImportedRecipe,
  type Ingredient,
} from "@/types/recipe";

export type DedupMatch =
  | { kind: "own"; recipe: Recipe }
  | { kind: "other"; recipe: Recipe }
  | null;

export async function findExistingImport(
  canonicalUrl: string,
  userId: string
): Promise<DedupMatch> {
  const base = { canonicalUrl, source: "url" } as const;
  const latest = { orderBy: { createdAt: "desc" } } as const;

  const own = await prisma.recipe.findFirst({
    where: { ...base, userId },
    ...latest,
  });
  if (own) return { kind: "own", recipe: own };

  // Other users' recipes only count as a dedup source when public — matching
  // getRecipe's own visibility rule (userId === user.id || isPublic). Without
  // this, a private recipe's title/ingredients/nutrition would leak to a
  // stranger who happens to import the same URL.
  //
  // Prefer a source with completed AND non-zero nutrition so the copy path
  // has something worth copying. `calories: { gt: 0 }` is a pragmatic
  // single-column proxy for "the FDC analysis actually resolved something" —
  // analysis can report success with an all-zero profile when no ingredient
  // matched (see hasNonZeroProfile in actions/recipe.ts for the full
  // multi-field check; replicating that as a multi-column OR isn't expressible
  // in a single Prisma `where`). Falls back to any import of the same URL.
  const analyzed = await prisma.recipe.findFirst({
    where: { ...base, userId: { not: userId }, isPublic: true, calories: { gt: 0 } },
    ...latest,
  });
  if (analyzed) return { kind: "other", recipe: analyzed };

  const any = await prisma.recipe.findFirst({
    where: { ...base, userId: { not: userId }, isPublic: true },
    ...latest,
  });
  return any ? { kind: "other", recipe: any } : null;
}

/** Stored `ingredients` Json → form shape, defensively. */
function toIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (trimmed.length === 0) return [];
      // Legacy/plain-string `Recipe.ingredients` rows are the "canonical
      // case" per formatIngredientsForNutrition's own comment — reuse the
      // same line parser the nutrition pipeline uses instead of dropping the
      // ingredient, which silently produced an empty array and failed the
      // form's `.min(1)` validation for the new importer.
      const { name, qty, unit } = parseIngredientLine(trimmed);
      return [{ name, amount: qty, unit }];
    }
    if (typeof item !== "object" || item === null) return [];
    const { name, amount, unit } = item as Record<string, unknown>;
    if (typeof name !== "string" || name.length === 0) return [];
    return [
      {
        name,
        amount: typeof amount === "number" ? amount : 0,
        unit: typeof unit === "string" ? unit : undefined,
      },
    ];
  });
}

/**
 * Map an existing Recipe row to the `ImportedRecipe` preview shape.
 * `sourceUrl` is the NEW importer's raw pasted URL — provenance stays theirs,
 * not the source row's.
 */
export function recipeRowToImported(row: Recipe, sourceUrl: string): ImportedRecipe {
  // The stored column is a plain String; the chat confirm-resume path
  // re-parses the payload against the strict difficulty enum, so an
  // out-of-enum legacy value must be dropped here, not crash there.
  const difficulty = recipeDifficultyEnum.safeParse(row.difficulty);
  return {
    title: row.title,
    description: row.description ?? undefined,
    prepTime: row.prepTime ?? undefined,
    cookTime: row.cookTime ?? undefined,
    servings: row.servings,
    difficulty: difficulty.success ? difficulty.data : undefined,
    ingredients: toIngredients(row.ingredients),
    instructions: row.instructions,
    imageUrl: row.imageUrl ?? undefined,
    tags: row.tags,
    calories: row.calories ?? undefined,
    protein: row.protein ?? undefined,
    carbs: row.carbs ?? undefined,
    fat: row.fat ?? undefined,
    fiber: row.fiber ?? undefined,
    sugar: row.sugar ?? undefined,
    sodium: row.sodium ?? undefined,
    sourceUrl,
  };
}
