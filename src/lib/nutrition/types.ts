/**
 * Nutrition-analysis domain types (the Resolve / Compute seam).
 *
 * The home of the per-ingredient **resolution record** (`IngredientResolution`)
 * and the public IO result shapes. Type-only — no runtime imports — so both the
 * server pipeline and client components (via the `@/actions/analyzeRecipe`
 * re-export) can share it without dragging in `server-only` modules.
 *
 * See `CONTEXT.md` → "Resolve / Compute seam" and "IngredientResolution".
 *
 * @module lib/nutrition/types
 */
import type { Macro, Profile, FdcFood } from "@/lib/fdc";
import type { ParsedIngredient } from "@/lib/ingredients";
import type { MacroEstimate } from "@/lib/ingredient-canonicalizer";

/**
 * Honest per-ingredient outcome (ADR 0003). `OK` = matched a USDA food;
 * `ESTIMATED` = no USDA match, macros estimated by the LLM (flagged, soft);
 * `UNRECOGNIZED` = not a food, or a food we could neither match nor estimate —
 * surfaced, never silently zeroed into a confident total; `MISSING_QTY` reserved
 * for a line with no resolvable quantity.
 */
export type IngredientStatus = "OK" | "ESTIMATED" | "UNRECOGNIZED" | "MISSING_QTY";

/** Where this ingredient's nutrition came from. */
export type IngredientSource = "fdc" | "llm_estimate" | "none";

/**
 * Recipe-level honesty summary — how many ingredients resolved, were estimated,
 * or could not be recognized. Drives the "12/13 resolved" coverage line.
 */
export interface CoverageSummary {
  total: number;
  resolved: number;
  estimated: number;
  unrecognized: number;
}

/** A lightweight reference to the food a no-match attempted, for debugging. */
export interface MatchRef {
  fdcId: number;
  description: string | null;
  dataType: string | null;
}

/**
 * Three-state canonicalization signal. Distinguishes a real canonical **name**, a
 * confirmed **not-a-food**, and an **unresolved** miss (LLM outage / cache miss).
 * The miss/not-food split is what stops a transient LLM failure from masquerading
 * as "not a food" (bug #1, fixed in the canonicalize boundary). Populated by the
 * resolver for logging + diagnostics.
 */
export type CanonicalOutcome =
  | { kind: "name"; value: string }
  | { kind: "not-food" }
  | { kind: "unresolved" };

/**
 * Per-ingredient decision trace — the structured record of HOW an ingredient
 * landed where it did. The substrate the logging seam reads.
 */
export interface ResolutionTrace {
  /** How the final outcome was chosen. */
  selectedVia: "not-food" | "stage2-llm" | "deterministic" | "estimate" | "none";
  /** Number of plausible USDA candidates fetched for this ingredient. */
  candidateCount: number;
}

/** Fields shared by every resolution variant. */
interface ResolutionBase {
  /** Parsed ingredient, with the canonical (or raw) name used for matching. */
  parsed: ParsedIngredient;
  /** Stage-2 cooked/raw judgment, when available. */
  cookedState?: "raw" | "cooked";
  /** True when Stage 2 defaulted to raw-as-entered on low confidence. */
  cookedFlagged?: boolean;
  /** Three-state canonicalization outcome (name / not-food / unresolved). */
  canonical?: CanonicalOutcome;
  /** Decision trace for structured logging + diagnostics. */
  trace?: ResolutionTrace;
}

/**
 * The per-ingredient **resolution record** — a discriminated union on `status`,
 * so an `OK` record always carries a `food`, an `ESTIMATED` one always carries an
 * `estimate`, and a no-match never pretends to have either. One record replaces
 * the prior set of index-aligned parallel arrays; the messy progressive
 * enrichment is private to the resolver, this union is what it hands back.
 */
export type IngredientResolution =
  | (ResolutionBase & {
      status: "OK";
      source: "fdc";
      food: FdcFood;
      grams: number;
      confidence: number;
      note: string;
      /** Stage-2 retention multiplier in [0,1] (applied to micronutrients only). */
      retentionFactor: number;
    })
  | (ResolutionBase & {
      status: "ESTIMATED";
      source: "llm_estimate";
      /** Per-100g LLM macro estimate (micros unknown → 0). */
      estimate: MacroEstimate;
      grams: number;
      confidence: number;
      note: string;
    })
  | (ResolutionBase & {
      status: "UNRECOGNIZED";
      source: "none";
      /** The food a no-match attempted (for debugging), or null. */
      bestMatch: MatchRef | null;
      note: string;
    })
  | (ResolutionBase & {
      status: "MISSING_QTY";
      source: "none";
      bestMatch: MatchRef | null;
      note: string;
    });

// --- Public IO result types (consumed by the actions, UI, and chat tool) ---

/** Input parameters for recipe analysis. */
export interface AnalyzeInput {
  /** Array of ingredient lines (one per line). */
  ingredients: string[];
  /** Number of servings the recipe yields. */
  servings: number;
  /** Recipe title — feeds the fingerprint cache key + Stage-2 cooked/raw judgment. */
  title?: string;
}

/** Per-ingredient result for the 5-macro pipeline. */
export interface IngredientResult {
  original: string;
  name: string;
  fdcId: number | null;
  description: string | null;
  gramsTotal: number;
  macros: Macro;
  confidence: number;
  portionNote: string;
  dataType: string | null;
  status: IngredientStatus;
  source: IngredientSource;
  cookedState?: "raw" | "cooked";
  cookedFlagged?: boolean;
}

/** Complete 5-macro recipe analysis result. */
export interface AnalyzeResult {
  items: IngredientResult[];
  total: Macro;
  perServing: Macro;
  coverage: CoverageSummary;
  dietLabels?: string[];
  healthLabels?: string[];
  success: boolean;
  error?: string;
}

/**
 * Per-ingredient result for the full-profile pipeline. Carries the fields the
 * `RecipeIngredient` row needs plus the honest `status`/`source` provenance.
 */
export interface IngredientProfileResult {
  original: string;
  name: string;
  nameNorm: string;
  qty: number;
  unit: string;
  fdcId: number | null;
  description: string | null;
  gramsTotal: number;
  confidence: number;
  portionNote: string;
  dataType: string | null;
  status: IngredientStatus;
  source: IngredientSource;
  cookedState?: "raw" | "cooked";
  cookedFlagged?: boolean;
  /**
   * This ingredient's 5 macros, projected from its profile contribution. Lets the
   * per-ingredient breakdown show macros without a second analysis pass. Optional:
   * profiles cached before this field existed simply omit it.
   */
  macros?: Macro;
}

/** Complete full-profile (22-nutrient) recipe analysis result. */
export interface AnalyzeProfileResult {
  items: IngredientProfileResult[];
  total: Profile;
  perServing: Profile;
  coverage: CoverageSummary;
  dietLabels?: string[];
  healthLabels?: string[];
  success: boolean;
  error?: string;
}
