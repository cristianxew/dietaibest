/**
 * Recipe Analysis Server Actions.
 *
 * Thin orchestration over the Resolve / Compute seam (see `CONTEXT.md`):
 *   validate → (analysis cache) → resolveIngredients → compute → (persist).
 *
 * The decision pipeline (parse → canonicalize → search → Stage 2 → grams →
 * status) lives in `@/lib/nutrition/resolve-ingredients`; turning records into
 * numbers lives in `@/lib/nutrition/compute`. This file owns only request
 * validation, the recipe-analysis cache, and the result envelope.
 *
 * @module actions/analyzeRecipe
 */

"use server";

import { divideProfile, zeroProfile, type Macro } from "@/lib/fdc";
import { generateRecipeFingerprint } from "@/lib/recipe-fingerprint";
import {
  getRecipeAnalysisCached,
  saveRecipeAnalysis,
} from "@/lib/recipe-analysis-repo";
import { resolveIngredients } from "@/lib/nutrition/resolve-ingredients";
import { computeMacros, computeProfile } from "@/lib/nutrition/compute";
import { createNutritionLogger } from "@/lib/nutrition/log";
import type {
  AnalyzeInput,
  AnalyzeProfileResult,
  AnalyzeResult,
  CoverageSummary,
  IngredientProfileResult,
} from "@/lib/nutrition/types";
import type { Profile } from "@/lib/fdc";

// Re-export the IO types so existing `@/actions/analyzeRecipe` imports (UI,
// chat tool, tests) keep resolving — the canonical home is now nutrition/types.
export type {
  AnalyzeInput,
  AnalyzeProfileResult,
  AnalyzeResult,
  CoverageSummary,
  IngredientProfileResult,
  IngredientResult,
  IngredientSource,
  IngredientStatus,
} from "@/lib/nutrition/types";

/** Create a zero macro object. */
function zeroMacro(): Macro {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
}

/** Empty coverage for failed/short-circuited analyses. */
function emptyCoverage(): CoverageSummary {
  return { total: 0, resolved: 0, estimated: 0, unrecognized: 0 };
}

/** A failed 5-macro result with zeroed totals and empty coverage. */
function failedMacro(error: string): AnalyzeResult {
  return {
    items: [],
    total: zeroMacro(),
    perServing: zeroMacro(),
    coverage: emptyCoverage(),
    success: false,
    error,
  };
}

/** A failed full-profile result with zeroed totals and empty coverage. */
function failedProfile(error: string): AnalyzeProfileResult {
  return {
    items: [],
    total: zeroProfile(),
    perServing: zeroProfile(),
    coverage: emptyCoverage(),
    success: false,
    error,
  };
}

/**
 * Analyze a list of ingredients into 5 macros (per serving). Backs the
 * `/nutrition` calculator's quick path.
 *
 * @param input - Analysis input with ingredients and servings
 * @returns Per-ingredient items, total, and per-serving macros + honest coverage
 */
export async function analyzeRecipeAction(
  input: AnalyzeInput
): Promise<AnalyzeResult> {
  try {
    const { ingredients, servings } = input;

    if (!ingredients || ingredients.length === 0) {
      return failedMacro("No ingredients provided");
    }
    if (!servings || servings <= 0) {
      return failedMacro("Servings must be a positive number");
    }
    if (ingredients.length > 100) {
      return failedMacro("Too many ingredients (max 100)");
    }

    const log = createNutritionLogger();
    log.info("analyze:macro", {
      ingredients: ingredients.length,
      servings,
      llm: process.env.INGREDIENT_LLM_FALLBACK === "1",
      title: input.title ?? "(untitled)",
    });
    const t0 = Date.now();

    const { resolutions, stage2 } = await resolveIngredients(
      ingredients,
      input.title,
      log
    );
    const { items, total, perServing, coverage } = computeMacros(
      resolutions,
      servings
    );

    log.info("analyze:macro done", {
      ms: Date.now() - t0,
      resolved: coverage.resolved,
      estimated: coverage.estimated,
      unrecognized: coverage.unrecognized,
      total: coverage.total,
      kcal: Math.round(perServing.kcal),
    });

    return {
      items,
      total,
      perServing,
      coverage,
      dietLabels: stage2.dietLabels,
      healthLabels: stage2.healthLabels,
      success: true,
    };
  } catch (error) {
    console.error("[analyzeRecipe] Unexpected error:", error);
    return failedMacro(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during analysis"
    );
  }
}

/**
 * Analyze a list of ingredients into a full 22-nutrient profile (per serving).
 * The FDC engine that backs recipe persistence, the `/nutrition` calculator, and
 * the chat `getNutrition` tool.
 *
 * @param input - Analysis input with ingredient lines and servings
 * @returns Per-ingredient items, total, and per-serving profile + honest coverage
 */
export async function analyzeRecipeProfileAction(
  input: AnalyzeInput
): Promise<AnalyzeProfileResult> {
  try {
    const { ingredients, servings, title } = input;

    if (!ingredients || ingredients.length === 0) {
      return failedProfile("No ingredients provided");
    }
    if (!servings || servings <= 0) {
      return failedProfile("Servings must be a positive number");
    }
    if (ingredients.length > 100) {
      return failedProfile("Too many ingredients (max 100)");
    }

    // Recipe-analysis cache (ADR 0003 D): a fingerprint hit short-circuits the
    // whole pipeline — no USDA fetch, no LLM stages. Flag-gated (off → null), so
    // the eval (flag off) never touches the DB. The cached `total`/`items` are
    // servings-independent; perServing is recomputed for the requested servings.
    const log = createNutritionLogger();
    const fingerprint = generateRecipeFingerprint({
      title: title ?? "",
      ingr: ingredients,
    });
    log.info("analyze:profile", {
      ingredients: ingredients.length,
      servings,
      llm: process.env.INGREDIENT_LLM_FALLBACK === "1",
      title: title ?? "(untitled)",
      fp: fingerprint.slice(0, 12),
    });

    const cached = await getRecipeAnalysisCached(fingerprint);
    if (cached) {
      log.info("cache HIT — short-circuit", {
        resolved: cached.coverage.resolved,
        total: cached.coverage.total,
      });
      const p = cached.profile as {
        items: IngredientProfileResult[];
        total: Profile;
        perServing: Profile;
      };
      return {
        items: p.items,
        total: p.total,
        perServing: divideProfile(p.total, servings),
        coverage: cached.coverage,
        dietLabels: cached.stage2.dietLabels,
        healthLabels: cached.stage2.healthLabels,
        success: true,
      };
    }

    const t0 = Date.now();
    const { resolutions, stage2 } = await resolveIngredients(
      ingredients,
      title,
      log
    );
    const { items, total, perServing, coverage } = computeProfile(
      resolutions,
      servings
    );

    // Persist the analysis (the cacheable USDA asset). Flag-gated → no-op when
    // off; best-effort write never breaks the response. Only successful results
    // reach here (exceptions are caught below and never cached).
    await saveRecipeAnalysis({
      fingerprint,
      servings,
      profile: { items, total, perServing },
      stage2,
      coverage,
    });

    log.info("analyze:profile done", {
      ms: Date.now() - t0,
      resolved: coverage.resolved,
      estimated: coverage.estimated,
      unrecognized: coverage.unrecognized,
      total: coverage.total,
      kcal: Math.round(perServing.calories),
    });

    return {
      items,
      total,
      perServing,
      coverage,
      dietLabels: stage2.dietLabels,
      healthLabels: stage2.healthLabels,
      success: true,
    };
  } catch (error) {
    console.error("[analyzeRecipeProfile] Unexpected error:", error);
    return failedProfile(
      error instanceof Error
        ? error.message
        : "An unexpected error occurred during analysis"
    );
  }
}
