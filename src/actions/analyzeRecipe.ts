/**
 * Recipe Analysis Server Action
 * Orchestrates complete nutrition analysis pipeline from ingredient lines to macros
 *
 * @module actions/analyzeRecipe
 */

"use server";

import {
  parseIngredientLine,
  type ParsedIngredient,
} from "@/lib/ingredients";
import {
  extractMacrosFromFood,
  foodHasEnergy,
  scalePer100g,
  extractProfileFromFood,
  scaleProfilePer100g,
  scaleProfileWithRetention,
  profileFromMacroEstimate,
  addProfile,
  divideProfile,
  zeroProfile,
  type Macro,
  type Profile,
  type FdcFood,
  type FdcSearchFood,
} from "@/lib/fdc";
import { resolveGramWeight } from "@/lib/gram-resolution";
import { rankMatches, matchPlausible } from "@/lib/fdc-match";
import { stapleFdcId } from "@/lib/fdc-staples";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import { canonicalizeCached, getMacroEstimates } from "@/lib/ingredient-name-repo";
import { type MacroEstimate } from "@/lib/ingredient-canonicalizer";
import { generateRecipeFingerprint } from "@/lib/recipe-fingerprint";
import {
  getRecipeAnalysisCached,
  runRecipeStage2,
  saveRecipeAnalysis,
} from "@/lib/recipe-analysis-repo";
import { type RecipeAnalysis } from "@/lib/recipe-analyzer";

/**
 * Input parameters for recipe analysis
 */
export interface AnalyzeInput {
  /** Array of ingredient lines (one per line) */
  ingredients: string[];
  /** Number of servings the recipe yields */
  servings: number;
  /** Recipe title — feeds the fingerprint cache key + Stage-2 cooked/raw judgment. */
  title?: string;
}

/**
 * Per-ingredient analysis result
 */
export interface IngredientResult {
  /** Original ingredient line */
  original: string;
  /** Parsed ingredient name */
  name: string;
  /** FDC food ID if matched */
  fdcId: number | null;
  /** FDC food description */
  description: string | null;
  /** Total grams for this ingredient */
  gramsTotal: number;
  /** Macro nutrients for this ingredient */
  macros: Macro;
  /** Confidence score (0-1) */
  confidence: number;
  /** Explanation of how portions were resolved */
  portionNote: string;
  /** Data type from FDC */
  dataType: string | null;
  /** Honest outcome (see IngredientStatus). */
  status: IngredientStatus;
  /** Nutrition provenance (fdc | llm_estimate | none). */
  source: IngredientSource;
  /** Stage-2 cooked/raw judgment, when available. */
  cookedState?: "raw" | "cooked";
  /** True when Stage 2 defaulted to raw-as-entered on low confidence. */
  cookedFlagged?: boolean;
}

/**
 * Complete recipe analysis result
 */
export interface AnalyzeResult {
  /** Per-ingredient results */
  items: IngredientResult[];
  /** Total macros for entire recipe */
  total: Macro;
  /** Macros per serving */
  perServing: Macro;
  /** Honest coverage summary (resolved / estimated / unrecognized counts). */
  coverage: CoverageSummary;
  /** Recipe-level diet labels from Stage 2 (e.g. "high-protein"). */
  dietLabels?: string[];
  /** Recipe-level health labels from Stage 2 (e.g. "vegan", "gluten-free"). */
  healthLabels?: string[];
  /** Overall success status */
  success: boolean;
  /** Error message if analysis failed */
  error?: string;
}

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

/**
 * Per-ingredient result for the full-profile pipeline. Carries the fields the
 * `RecipeIngredient` row needs (originalText/nameNorm/qty/unit/fdcId/grams/confidence)
 * plus the honest `status`/`source` provenance.
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
  /** Stage-2 cooked/raw judgment, when available. */
  cookedState?: "raw" | "cooked";
  /** True when Stage 2 defaulted to raw-as-entered on low confidence. */
  cookedFlagged?: boolean;
}

/**
 * Complete full-profile (22-nutrient) recipe analysis result.
 */
export interface AnalyzeProfileResult {
  items: IngredientProfileResult[];
  total: Profile;
  perServing: Profile;
  /** Honest coverage summary (resolved / estimated / unrecognized counts). */
  coverage: CoverageSummary;
  /** Recipe-level diet labels from Stage 2 (e.g. "high-protein"). */
  dietLabels?: string[];
  /** Recipe-level health labels from Stage 2 (e.g. "vegan", "gluten-free"). */
  healthLabels?: string[];
  success: boolean;
  error?: string;
}

/**
 * Create a zero macro object
 */
function zeroMacro(): Macro {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
}

/**
 * Add two macro objects together
 */
function addMacros(a: Macro, b: Macro): Macro {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber + b.fiber,
  };
}

/**
 * Divide macro values by a number
 */
function divideMacros(m: Macro, divisor: number): Macro {
  return {
    kcal: m.kcal / divisor,
    protein: m.protein / divisor,
    fat: m.fat / divisor,
    carbs: m.carbs / divisor,
    fiber: m.fiber / divisor,
  };
}

/** How many top-ranked search candidates to keep per ingredient as fallbacks. */
const MAX_CANDIDATES_PER_INGREDIENT = 5;

/**
 * Analyze a list of ingredients and calculate nutrition
 *
 * @param input - Analysis input with ingredients and servings
 * @returns Complete analysis result with per-ingredient and total macros
 */
export async function analyzeRecipeAction(
  input: AnalyzeInput
): Promise<AnalyzeResult> {
  try {
    const { ingredients, servings } = input;

    // Validation
    if (!ingredients || ingredients.length === 0) {
      return failedMacro("No ingredients provided");
    }

    if (!servings || servings <= 0) {
      return failedMacro("Servings must be a positive number");
    }

    if (ingredients.length > 100) {
      return failedMacro("Too many ingredients (max 100)");
    }

    // Resolve FDC matches + gram weights via the shared pipeline
    const { matches: resolved, stage2 } = await resolveIngredientMatches(
      ingredients,
      input.title
    );

    const items: IngredientResult[] = [];
    let totalMacros = zeroMacro();

    for (const m of resolved) {
      const base = {
        original: m.parsed.original,
        name: m.parsed.name,
        status: m.status,
        source: m.source,
        cookedState: m.cookedState,
        cookedFlagged: m.cookedFlagged,
      };

      if (m.status === "OK" && m.food) {
        // Macros (kcal/protein/fat/carbs/fiber) are conserved by cooking, so the
        // Stage-2 retention factor does NOT apply on the macro path.
        const scaledMacros = scalePer100g(
          extractMacrosFromFood(m.food),
          m.grams
        );
        items.push({
          ...base,
          fdcId: m.food.fdcId,
          description: m.food.description,
          gramsTotal: m.grams,
          macros: scaledMacros,
          confidence: m.confidence,
          portionNote: m.note,
          dataType: m.food.dataType,
        });
        totalMacros = addMacros(totalMacros, scaledMacros);
        continue;
      }

      if (m.status === "ESTIMATED" && m.estimate) {
        // The MacroEstimate is per-100g and shares Macro's shape; scale by grams.
        const scaledMacros = scalePer100g(m.estimate, m.grams);
        items.push({
          ...base,
          fdcId: null,
          description: null,
          gramsTotal: m.grams,
          macros: scaledMacros,
          confidence: m.confidence,
          portionNote: m.note,
          dataType: null,
        });
        totalMacros = addMacros(totalMacros, scaledMacros);
        continue;
      }

      // UNRECOGNIZED / MISSING_QTY — surfaced, contributes 0.
      items.push({
        ...base,
        fdcId: m.bestMatch?.fdcId ?? null,
        description: m.bestMatch?.description ?? null,
        gramsTotal: 0,
        macros: zeroMacro(),
        confidence: 0,
        portionNote: m.note,
        dataType: m.bestMatch?.dataType ?? null,
      });
    }

    // Calculate per-serving macros
    const perServing = divideMacros(totalMacros, servings);

    console.log(
      `[analyzeRecipe] Analysis complete: ${items.length} ingredients, ${servings} servings`
    );

    return {
      items,
      total: totalMacros,
      perServing,
      coverage: summarize(items),
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

/** A failed 5-macro result with zeroed totals and empty coverage. */
function failedMacro(error: string): AnalyzeResult {
  return {
    items: [],
    total: zeroMacro(),
    perServing: zeroMacro(),
    coverage: { total: 0, resolved: 0, estimated: 0, unrecognized: 0 },
    success: false,
    error,
  };
}

/**
 * Resolved FDC match for one ingredient line: the parsed ingredient, the chosen
 * food (or null when unmatched), and its resolved gram weight + confidence.
 *
 * Shared gram-resolution pipeline (parse → search → best-match → cache → grams)
 * used by the full-profile analysis. Reuses the leaf helpers `chooseBestMatch`
 * and `resolveGramWeight`.
 */
interface ResolvedIngredientMatch {
  /** Parsed ingredient, with the LLM canonical name applied for matching. */
  parsed: ParsedIngredient;
  bestMatch: FdcSearchFood | null;
  food: FdcFood | null;
  grams: number;
  confidence: number;
  note: string;
  status: IngredientStatus;
  source: IngredientSource;
  /** Per-100g macros when `source === "llm_estimate"`, else null. */
  estimate: MacroEstimate | null;
  /**
   * Stage-2 nutrient-retention multiplier in [0,1] (1 = no cooking-loss applied).
   * Defaults to 1 when Stage 2 is off or gave no entry for this ingredient.
   */
  retentionFactor: number;
  /** Stage-2 cooked/raw judgment, when available. */
  cookedState?: "raw" | "cooked";
  /** True when Stage 2 defaulted to raw-as-entered on low confidence. */
  cookedFlagged?: boolean;
}

/** What `resolveBatch` produces before honest status/source + Stage 2 are assigned. */
type BatchResolution = Omit<
  ResolvedIngredientMatch,
  | "status"
  | "source"
  | "estimate"
  | "retentionFactor"
  | "cookedState"
  | "cookedFlagged"
>;

/**
 * LLM-primary, single-pass resolution (ADR 0003):
 *   parse → ① canonicalize ALL names → search/rank/staple/guard → grams
 *         → ② estimate macros for foods USDA does not carry → honest status.
 *
 * Stage 1 (`canonicalizeCached`) is the PRIMARY normalizer (was a fallback): it
 * runs up front for every name so a multilingual name matches USDA without the
 * old `SYNONYMS` table. It is flag-gated and cached, so it amortizes to ~0 calls
 * after warmup; when the flag is off it returns an empty map and the pipeline
 * degrades to raw-name matching (honest UNRECOGNIZED on a miss).
 */
async function resolveIngredientMatches(
  ingredients: string[],
  title?: string
): Promise<{ matches: ResolvedIngredientMatch[]; stage2: RecipeAnalysis }> {
  const parsed: ParsedIngredient[] = ingredients
    .filter((line) => line.trim().length > 0)
    .map((line) => parseIngredientLine(line));

  // ① Canonicalize every name once, up front (keyed by the raw parsed name).
  const canonical = await canonicalizeCached(parsed.map((p) => p.name));

  // The name we actually search USDA with: the canonical when the LLM gave a
  // different one, else the raw parsed name (flag off / cache miss / same).
  const forMatch: ParsedIngredient[] = parsed.map((p) => {
    const c = canonical.get(p.name);
    return c != null && c.toLowerCase() !== p.name.toLowerCase()
      ? { ...p, name: c }
      : p;
  });
  // An explicit `null` from the LLM means "not a food" (section header, noise).
  const notFood = parsed.map((p) => canonical.get(p.name) === null);

  const resolved = await resolveBatch(forMatch);

  // ② For a food the deterministic pass could not match (and the LLM did NOT
  // call a non-food), estimate per-100g macros as the last coverage step.
  const estimateIdx = resolved.flatMap((m, i) =>
    m.food === null && !notFood[i] ? [i] : []
  );
  const estimates = estimateIdx.length
    ? await getMacroEstimates(estimateIdx.map((i) => forMatch[i].name))
    : new Map<string, MacroEstimate | null>();

  const baseMatches = resolved.map((m, i): ResolvedIngredientMatch => {
    // The LLM is authoritative on "not a food" — surface it even if free-text
    // search incidentally matched something.
    if (notFood[i]) {
      return { ...m, food: null, status: "UNRECOGNIZED", source: "none", estimate: null, retentionFactor: 1 };
    }
    if (m.food) {
      return { ...m, status: "OK", source: "fdc", estimate: null, retentionFactor: 1 };
    }
    const est = estimates.get(forMatch[i].name) ?? null;
    if (est) {
      const g = resolveGramWeight(forMatch[i], null);
      return {
        ...m,
        grams: g.grams,
        confidence: g.confidence,
        note: `LLM macro estimate (no USDA match); ${g.note}`,
        status: "ESTIMATED",
        source: "llm_estimate",
        estimate: est,
        retentionFactor: 1,
      };
    }
    return { ...m, status: "UNRECOGNIZED", source: "none", estimate: null, retentionFactor: 1 };
  });

  // ③ Stage 2 — recipe-scoped cooked/raw + retention + diet/health labels. Off
  // (flag) → an empty analysis, so every retentionFactor stays 1 and nothing is
  // scaled. Applied to OK (USDA) items only; estimates are already "as prepared".
  const stage2 = await runRecipeStage2({
    title,
    items: baseMatches.map((m) => ({
      name: m.parsed.name,
      grams: m.grams,
      description: m.food?.description ?? null,
    })),
  });
  const stage2ByName = new Map(stage2.perIngredient.map((p) => [p.name, p]));

  const matches = baseMatches.map((m): ResolvedIngredientMatch => {
    const s2 = stage2ByName.get(m.parsed.name);
    if (!s2) return m;
    return {
      ...m,
      // Retention only adjusts real USDA nutrition; estimates already reflect
      // the prepared food, so we don't double-apply a cooking loss to them.
      retentionFactor: m.status === "OK" ? s2.retentionFactor : 1,
      cookedState: s2.cookedState,
      cookedFlagged: s2.flagged,
    };
  });

  return { matches, stage2 };
}

/**
 * Resolve a list of already-parsed ingredients to FDC matches + gram weights:
 * search (cached) -> rank -> staple pin -> batch-fetch -> first plausible
 * candidate (staple bypasses the match-quality guard) -> resolveGramWeight.
 */
async function resolveBatch(
  parsed: ParsedIngredient[]
): Promise<BatchResolution[]> {
  const searchResults = await Promise.all(
    parsed.map(async (p) => {
      try {
        const foods = await searchFoodsCached(p.name);
        return { parsed: p, foods };
      } catch (error) {
        console.error(`[analyzeRecipe] Search failed for "${p.name}":`, error);
        return { parsed: p, foods: [] };
      }
    })
  );

  // Keep the top-N ranked candidates per ingredient (not just the single best)
  // so we can fall back when a higher-ranked food can't be fetched. When the
  // name is a curated staple, pin its verified fdcId as the first candidate —
  // free-text search mis-ranks staples ("onion" → "onion rings", "egg" → "Egg,
  // creamed") — while keeping the search hits as fallback.
  const ranked = searchResults.map(({ parsed, foods }) => {
    const searchCandidates = rankMatches(foods, parsed.name).slice(
      0,
      MAX_CANDIDATES_PER_INGREDIENT
    );
    const staple = stapleFdcId(parsed.name);
    const candidates =
      staple !== null
        ? [
            {
              fdcId: staple,
              description: parsed.name,
              dataType: "SR Legacy",
            } as FdcSearchFood,
            ...searchCandidates.filter((c) => c.fdcId !== staple),
          ]
        : searchCandidates;
    return { parsed, candidates };
  });

  // One batch fetch for every candidate across all ingredients.
  const fdcIds = [
    ...new Set(ranked.flatMap((m) => m.candidates.map((c) => c.fdcId))),
  ];
  const foodsDetailed = await getFoodsCached(fdcIds);
  const foodsById = new Map<number, FdcFood>();
  for (const food of foodsDetailed) {
    foodsById.set(food.fdcId, food);
  }

  const resolved: BatchResolution[] = [];
  for (const { parsed, candidates } of ranked) {
    if (!candidates.length) {
      resolved.push({
        parsed,
        bestMatch: null,
        food: null,
        grams: 0,
        confidence: 0,
        note: "No USDA match found",
      });
      continue;
    }

    // Walk candidates best-first and use the first that BOTH fetched and passes
    // the match-quality guard. USDA's /foods endpoint answers `{}` for some ids
    // that search returns (e.g. fdcId 747997), so the top hit can be unfetchable
    // — falling through keeps the ingredient from dropping to 0g. The guard then
    // rejects a non-staple food sharing no token with the query (the
    // "chicken→Clif bar" class) — a flagged no-match is more honest than
    // silently using the wrong food. Staple matches are trusted and bypass it.
    const staple = stapleFdcId(parsed.name);
    const fetchable = candidates.filter((c) => foodsById.has(c.fdcId));
    const plausible = fetchable.filter(
      (c) =>
        c.fdcId === staple ||
        matchPlausible(foodsById.get(c.fdcId)!.description, parsed.name)
    );
    // Prefer the staple (trusted), then the first plausible candidate that
    // actually carries energy — a branded food missing all energy nutrients
    // (208/957/958) would silently contribute 0 kcal (e.g. an energy-less
    // "BASMATI RICE" entry beating a proper one). Fall back to the first
    // plausible match for legitimately calorie-free foods (salt, water).
    const hit =
      plausible.find((c) => c.fdcId === staple) ??
      plausible.find((c) => foodHasEnergy(foodsById.get(c.fdcId)!)) ??
      plausible[0];
    if (!hit) {
      // A quality rejection is a clean no-match (fdcId null) — not a match that
      // resolved to 0g — so the UI flags "couldn't match" and the harness's
      // matched-but-zero-grams invariant doesn't misfire. A fetch failure keeps
      // the attempted id for debugging.
      const fetchFailed = fetchable.length === 0;
      resolved.push({
        parsed,
        bestMatch: fetchFailed ? candidates[0] : null,
        food: null,
        grams: 0,
        confidence: 0,
        note: fetchFailed
          ? "Failed to fetch food details"
          : "No plausible USDA match (low match quality)",
      });
      continue;
    }

    const food = foodsById.get(hit.fdcId)!;
    const { grams, confidence, note } = resolveGramWeight(parsed, food);
    resolved.push({ parsed, bestMatch: hit, food, grams, confidence, note });
  }

  return resolved;
}

/**
 * Analyze a list of ingredients into a full 22-nutrient profile (per serving).
 *
 * Reuses the shared gram-resolution pipeline, then extracts/scales/aggregates
 * the full `Profile` per ingredient and divides by servings. This is the FDC
 * engine that backs recipe persistence (replacing Edamam).
 *
 * @param input - Analysis input with ingredient lines and servings
 * @returns Per-ingredient items, total, and per-serving profile
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
    const fingerprint = generateRecipeFingerprint({
      title: title ?? "",
      ingr: ingredients,
    });
    const cached = await getRecipeAnalysisCached(fingerprint);
    if (cached) {
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

    const { matches: resolved, stage2 } = await resolveIngredientMatches(
      ingredients,
      title
    );

    const items: IngredientProfileResult[] = [];
    let total = zeroProfile();

    for (const m of resolved) {
      const base = {
        original: m.parsed.original,
        name: m.parsed.name,
        nameNorm: m.parsed.name,
        qty: m.parsed.qty,
        unit: m.parsed.unit,
        status: m.status,
        source: m.source,
        cookedState: m.cookedState,
        cookedFlagged: m.cookedFlagged,
      };

      if (m.status === "OK" && m.food) {
        // Stage-2 retention applies to micronutrients only (vitamins/minerals);
        // energy + macros are conserved, and reported grams stay raw-as-entered —
        // we never silently scale the weight (ADR 0003).
        const scaled = scaleProfileWithRetention(
          extractProfileFromFood(m.food),
          m.grams,
          m.retentionFactor
        );
        items.push({
          ...base,
          fdcId: m.food.fdcId,
          description: m.food.description,
          gramsTotal: m.grams,
          confidence: m.confidence,
          portionNote: m.note,
          dataType: m.food.dataType,
        });
        total = addProfile(total, scaled);
        continue;
      }

      if (m.status === "ESTIMATED" && m.estimate) {
        // Counted but flagged (ADR 0003 decision 1): the total stays complete,
        // the item is marked soft. Only the 5 macros are known; micros are 0.
        const scaled = scaleProfilePer100g(
          profileFromMacroEstimate(m.estimate),
          m.grams
        );
        items.push({
          ...base,
          fdcId: null,
          description: null,
          gramsTotal: m.grams,
          confidence: m.confidence,
          portionNote: m.note,
          dataType: null,
        });
        total = addProfile(total, scaled);
        continue;
      }

      // UNRECOGNIZED / MISSING_QTY: surfaced, contributes 0 — never a silent
      // confident zero folded into the total.
      items.push({
        ...base,
        fdcId: m.bestMatch?.fdcId ?? null,
        description: m.bestMatch?.description ?? null,
        gramsTotal: 0,
        confidence: 0,
        portionNote: m.note,
        dataType: m.bestMatch?.dataType ?? null,
      });
    }

    const perServing = divideProfile(total, servings);
    const coverage = summarize(items);

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

/** Empty coverage for failed/short-circuited analyses. */
function emptyCoverage(): CoverageSummary {
  return { total: 0, resolved: 0, estimated: 0, unrecognized: 0 };
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

/** Roll per-ingredient statuses up into the recipe coverage summary. */
function summarize(items: { status: IngredientStatus }[]): CoverageSummary {
  return {
    total: items.length,
    resolved: items.filter((i) => i.status === "OK").length,
    estimated: items.filter((i) => i.status === "ESTIMATED").length,
    unrecognized: items.filter(
      (i) => i.status === "UNRECOGNIZED" || i.status === "MISSING_QTY"
    ).length,
  };
}
