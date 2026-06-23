/**
 * Cached LLM-primary recipe analysis (ADR 0003, Stage 2 + persistence).
 *
 * Wraps the Stage-2 `RecipeAnalyzer` and the `RecipeAnalysisCache` table. Like
 * the Stage-1 wrappers (`canonicalizeCached`, `getMacroEstimates`), it is gated
 * by `INGREDIENT_LLM_FALLBACK` and **early-returns before touching the LLM or
 * Prisma when the flag is off** — this is what keeps the nutrition eval (which
 * runs flag-off, no DB, no network) green. When off, Stage 2 is a no-op and the
 * cache is invisible, so the pipeline behaves exactly as it did pre-ADR-0003.
 *
 * Only successful analyses are cached (the caller decides); a DB write failure
 * is swallowed (best-effort cache) so it never breaks an analysis.
 *
 * @module lib/recipe-analysis-repo
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import {
  getRecipeAnalyzer,
  type RecipeAnalysis,
  type RecipeAnalyzerInput,
} from "./recipe-analyzer";

/** Recipe coverage shape stored alongside the cached profile (structural). */
export interface CachedCoverage {
  total: number;
  resolved: number;
  estimated: number;
  unrecognized: number;
}

/**
 * The reconstructable analysis payload for one fingerprint. `profile` is the
 * caller's full profile result (items/total/perServing) — opaque to this
 * persistence layer, which keeps the repo decoupled from the action types. The
 * action casts it back to its own result shape.
 */
export interface CachedRecipeAnalysis {
  servings: number;
  profile: unknown;
  stage2: RecipeAnalysis;
  coverage: CachedCoverage;
}

function flagOff(): boolean {
  return process.env.INGREDIENT_LLM_FALLBACK !== "1";
}

const EMPTY_ANALYSIS: RecipeAnalysis = {
  perIngredient: [],
  dietLabels: [],
  healthLabels: [],
};

/**
 * Run Stage 2 over a recipe. Flag-gated: off → a no-op empty analysis without
 * calling the LLM, so callers apply no Stage-2 adjustment.
 */
export async function runRecipeStage2(
  input: RecipeAnalyzerInput
): Promise<RecipeAnalysis> {
  if (flagOff()) return EMPTY_ANALYSIS;
  return getRecipeAnalyzer().analyze(input);
}

/**
 * Look up a cached recipe analysis by fingerprint. Flag-gated: off → null
 * without any DB call.
 */
export async function getRecipeAnalysisCached(
  fingerprint: string
): Promise<CachedRecipeAnalysis | null> {
  if (flagOff()) return null;
  const row = await prisma.recipeAnalysisCache.findUnique({
    where: { fingerprint },
  });
  if (!row) return null;
  return {
    servings: row.servings,
    profile: row.profileJson,
    stage2: row.stage2Json as unknown as RecipeAnalysis,
    coverage: row.coverageJson as unknown as CachedCoverage,
  };
}

/**
 * Persist a successful recipe analysis. Flag-gated: off → no-op. The caller
 * passes only successful analyses (no-poison). A DB failure is swallowed so a
 * cache write never breaks the analysis it was meant to speed up.
 */
export async function saveRecipeAnalysis(args: {
  fingerprint: string;
  servings: number;
  profile: unknown;
  stage2: RecipeAnalysis;
  coverage: CachedCoverage;
}): Promise<void> {
  if (flagOff()) return;
  const data = {
    servings: args.servings,
    profileJson: args.profile as unknown as object,
    stage2Json: args.stage2 as unknown as object,
    coverageJson: args.coverage as unknown as object,
  };
  try {
    await prisma.recipeAnalysisCache.upsert({
      where: { fingerprint: args.fingerprint },
      create: { fingerprint: args.fingerprint, ...data },
      update: { ...data, lastAnalyzedAt: new Date() },
    });
  } catch (err) {
    console.error(
      "[recipe-analysis-repo] cache write failed (ignored):",
      err instanceof Error ? err.message : String(err)
    );
  }
}
