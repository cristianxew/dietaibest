import { z } from "zod";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";
import {
  getRecipe as getRecipeAction,
  saveRecipeNutritionProfile,
} from "@/actions/recipe";
import { formatIngredientsForNutrition } from "@/lib/ingredients";
import type { Profile } from "@/lib/fdc";
import type { Tool, ToolResult } from "./types";

const inputSchema = z.object({
  recipeId: z.string().min(1).optional(),
  ingredients: z.array(z.string().min(1)).min(1).max(50).optional(),
  servings: z.number().int().min(1).default(1),
}).refine(
  (v) => (v.recipeId && !v.ingredients) || (!v.recipeId && v.ingredients),
  { message: "Provide exactly one of recipeId or ingredients" }
);

type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

/**
 * The 17 micronutrient `Profile` fields (everything beyond the 5 core macros).
 * Mirrors the recipe detail page accordion so the chat surfaces the same set.
 */
const MICRO_KEYS = [
  "sugar",
  "sodium",
  "cholesterol",
  "saturatedFat",
  "transFat",
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "vitaminE",
  "vitaminK",
  "vitaminB12",
  "folate",
  "iron",
  "calcium",
  "magnesium",
  "potassium",
  "zinc",
] as const;

type MicroKey = (typeof MICRO_KEYS)[number];

/** Per-serving micronutrients. `null` = not present on a legacy recipe row. */
type Micros = Record<MicroKey, number | null>;

type NutritionData = {
  perServing: Macros;
  total: Macros;
  /**
   * Per-serving micronutrient breakdown — matches the recipe detail page.
   * A field is `null` when the persisted recipe predates micro storage.
   */
  micros: Micros;
  servings: number;
  /**
   * `"stored"` = read verbatim from the persisted recipe profile (zero FDC
   * cost, guaranteed equal to the recipe detail page). `"fdc"` = freshly
   * analyzed because the recipe had no stored profile or the input was an
   * ad-hoc ingredient list.
   */
  source: "stored" | "fdc";
  /**
   * The exact numeric values that the LLM is allowed to surface. The guardrail
   * uses this list to decide whether a number in the prose is tool-grounded.
   * Carries BOTH macros and micros so a micro figure quoted near a macro
   * keyword is not collaterally redacted. Numbers are rounded to integers for
   * prose comparison; the structured card keeps fractional precision.
   */
  groundedValues: number[];
};

function roundForProse(n: number): number {
  return Math.round(n);
}

function scaleMacros(m: Macros, factor: number): Macros {
  return {
    kcal: m.kcal * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fiber: m.fiber * factor,
  };
}

function macrosFromProfile(p: Profile): Macros {
  return {
    kcal: p.calories,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    fiber: p.fiber,
  };
}

function microsFromProfile(p: Profile): Micros {
  const out = {} as Micros;
  for (const key of MICRO_KEYS) out[key] = p[key];
  return out;
}

function microsFromRecipe(r: Record<MicroKey, number | null>): Micros {
  const out = {} as Micros;
  for (const key of MICRO_KEYS) out[key] = r[key] ?? null;
  return out;
}

function collectGroundedValues(
  perServing: Macros,
  total: Macros,
  micros: Micros
): number[] {
  const candidates: number[] = [
    perServing.kcal,
    perServing.protein,
    perServing.carbs,
    perServing.fat,
    perServing.fiber,
    total.kcal,
    total.protein,
    total.carbs,
    total.fat,
    total.fiber,
  ];
  for (const key of MICRO_KEYS) {
    const v = micros[key];
    if (v !== null) candidates.push(v);
  }
  return candidates.map(roundForProse).filter((n) => Number.isFinite(n) && n >= 0);
}

/**
 * Analyze ingredient lines fresh through the FDC engine (full 22-nutrient
 * profile). When `persistToRecipeId` is set (the caller owns that recipe), the
 * full profile is backfilled onto it so the detail page and the next lookup
 * show the same numbers — including micros. Persistence is best-effort: a write
 * failure must never fail the analysis.
 */
async function analyzeFresh(
  ingredients: string[],
  servings: number,
  persistToRecipeId?: string,
  title?: string
): Promise<ToolResult<NutritionData>> {
  const analysis = await analyzeRecipeProfileAction({ ingredients, servings, title });
  if (!analysis.success) {
    return {
      ok: false,
      reason: "generic",
      message: analysis.error ?? "Analysis failed",
    };
  }

  if (persistToRecipeId) {
    await saveRecipeNutritionProfile(persistToRecipeId, analysis.perServing);
  }

  const perServing = macrosFromProfile(analysis.perServing);
  const total = macrosFromProfile(analysis.total);
  const micros = microsFromProfile(analysis.perServing);

  return {
    ok: true,
    data: {
      perServing,
      total,
      micros,
      servings,
      source: "fdc",
      groundedValues: collectGroundedValues(perServing, total, micros),
    },
  };
}

export const getNutrition: Tool<typeof inputSchema, NutritionData> = {
  name: "getNutrition",
  description:
    "Get nutrition (calories, protein, carbs, fat, fiber + the full micronutrient breakdown) for an existing recipe (by recipeId) OR a free-form ingredient list. For a saved recipe that already has a stored profile it returns the persisted per-serving values verbatim — identical to the recipe detail page — at zero cost; otherwise it analyzes fresh via USDA FDC. This is the ONLY authoritative source of nutrition numbers — never invent or estimate them in prose.",
  inputSchema,
  statusKey: "recipe.analyzing",
  requiresFeature: "aiChat",
  async execute(input) {
    if (input.recipeId) {
      const recipe = await getRecipeAction(input.recipeId);
      if (recipe.error || !recipe.data) {
        return {
          ok: false,
          reason: "notFound",
          message:
            typeof recipe.error === "string" ? recipe.error : "Recipe not found",
        };
      }

      const r = recipe.data;

      // Stored-profile fast path: a saved recipe that already carries a
      // per-serving profile returns the persisted numbers verbatim, so the chat
      // figure equals the recipe detail page at zero FDC cost.
      if (typeof r.calories === "number") {
        const perServing: Macros = {
          kcal: r.calories,
          protein: r.protein ?? 0,
          carbs: r.carbs ?? 0,
          fat: r.fat ?? 0,
          fiber: r.fiber ?? 0,
        };
        const total = scaleMacros(perServing, r.servings);
        const micros = microsFromRecipe(r);
        return {
          ok: true,
          data: {
            perServing,
            total,
            micros,
            servings: r.servings,
            source: "stored",
            groundedValues: collectGroundedValues(perServing, total, micros),
          },
        };
      }

      // Un-analyzed recipe → analyze fresh via FDC and backfill the full
      // profile when the user owns the recipe, so the macros AND micros land on
      // the detail page without the model having to copy them back. The recipe
      // `title` is threaded through so chat and the recipe form share one cache
      // key (same fingerprint) and Stage-2 gets the same cooked/raw signal.
      return analyzeFresh(
        formatIngredientsForNutrition(r.ingredients),
        r.servings,
        r.viewerIsOwner ? r.id : undefined,
        r.title
      );
    }

    // Ad-hoc ingredient list → analyze fresh via FDC.
    return analyzeFresh(input.ingredients!, input.servings);
  },
};
