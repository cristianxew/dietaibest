/**
 * Deterministic recipe fingerprint.
 *
 * A stable SHA-256 over a recipe's title + ingredient lines (lower-cased,
 * trimmed, ingredient order normalized), used as a cache key to identify the
 * "same" recipe across analyses. Extracted from `edamam.ts` into a neutral,
 * dependency-free module so the LLM-primary engine (ADR 0003) can key its
 * `RecipeAnalysisCache` on it without importing the (soon-retired) Edamam client.
 *
 * @module lib/recipe-fingerprint
 */
import { createHash } from "crypto";

/** Minimal recipe shape the fingerprint needs (title + ingredient lines). */
export interface RecipeFingerprintInput {
  title: string;
  /** Array of ingredient lines. */
  ingr: string[];
}

/**
 * Generate a deterministic fingerprint for recipe content. Two recipes with the
 * same title and the same set of ingredient lines (ignoring case, surrounding
 * whitespace, and ingredient ordering) produce the same hash.
 */
export function generateRecipeFingerprint(
  recipe: RecipeFingerprintInput
): string {
  const content = JSON.stringify({
    title: recipe.title.trim().toLowerCase(),
    ingredients: recipe.ingr.map((i) => i.trim().toLowerCase()).sort(),
  });
  return createHash("sha256").update(content).digest("hex");
}
