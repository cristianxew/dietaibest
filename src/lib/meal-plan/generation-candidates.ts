/**
 * Candidate recipes for AI meal-plan generation.
 *
 * The fanout step must only ever assign recipe ids that exist and that the
 * user may use. Instead of letting the model invent an id, we load the
 * candidate pool once, show it to the model as a numbered list, and let the
 * model answer with an INDEX. `pickCandidate` maps that index back to a real
 * UUID server-side, so an invalid answer can never reach the database.
 *
 * Pool (product decision, see docs/adr/0005): the user's own recipes plus
 * favorited recipes that are still public — the same visibility rule the
 * favorites tab uses in `getRecipes`.
 */
import prisma from "@/lib/prisma";

export interface CandidateRecipe {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  /** Per-serving macros; null when the recipe was never analyzed. */
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

/** Enough variety for a 14-day plan while keeping the prompt cacheable. */
export const MAX_CANDIDATE_RECIPES = 150;

export async function loadCandidateRecipes(
  userId: string,
  opts: { allergies?: string[] } = {}
): Promise<CandidateRecipe[]> {
  const rows = await prisma.recipe.findMany({
    where: {
      OR: [
        { userId },
        { isPublic: true, favoritedBy: { some: { userId } } },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      calories: true,
      protein: true,
      carbs: true,
      fat: true,
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_CANDIDATE_RECIPES,
  });
  return excludeAllergens(rows, opts.allergies ?? []);
}

/**
 * Deterministic pre-filter: drop recipes whose title or tags mention an
 * allergen. Ingredient-level exclusion is delegated to the model prompt
 * (ingredients are free-form JSON and not reliable for substring matching).
 */
export function excludeAllergens(
  candidates: CandidateRecipe[],
  allergies: string[]
): CandidateRecipe[] {
  const needles = allergies.map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (needles.length === 0) return candidates;
  return candidates.filter((recipe) => {
    const haystack = [recipe.title, ...recipe.tags].map((s) => s.toLowerCase());
    return !needles.some((needle) => haystack.some((h) => h.includes(needle)));
  });
}

function formatMacros(recipe: CandidateRecipe): string {
  if (recipe.calories === null) return "macros unknown";
  const parts = [`${Math.round(recipe.calories)} kcal/serving`];
  if (recipe.protein !== null) parts.push(`P${Math.round(recipe.protein)}`);
  if (recipe.carbs !== null) parts.push(`C${Math.round(recipe.carbs)}`);
  if (recipe.fat !== null) parts.push(`F${Math.round(recipe.fat)}`);
  return parts.join(" ");
}

/**
 * Numbered list for the prompt. Indices are the candidate's position in the
 * ORIGINAL array (that is what `pickCandidate` resolves); `rotateBy` only
 * changes presentation order so parallel slots don't all anchor on the same
 * first few rows — a cheap variety nudge with no extra calls.
 */
export function formatCandidatesForPrompt(
  candidates: CandidateRecipe[],
  rotateBy = 0
): string {
  if (candidates.length === 0) return "";
  const n = candidates.length;
  const start = ((rotateBy % n) + n) % n;
  const lines: string[] = [];
  for (let k = 0; k < n; k++) {
    const idx = (start + k) % n;
    const recipe = candidates[idx];
    const tags = recipe.tags.length ? ` | ${recipe.tags.join(", ")}` : "";
    const description = recipe.description?.trim()
      ? ` — ${recipe.description.trim().slice(0, 120)}`
      : "";
    lines.push(`#${idx} ${recipe.title} | ${formatMacros(recipe)}${tags}${description}`);
  }
  return lines.join("\n");
}

/** Resolve a model answer to a real candidate. Anything invalid → null. */
export function pickCandidate(
  candidates: CandidateRecipe[],
  index: unknown
): CandidateRecipe | null {
  if (typeof index !== "number" || !Number.isInteger(index)) return null;
  if (index < 0 || index >= candidates.length) return null;
  return candidates[index];
}
