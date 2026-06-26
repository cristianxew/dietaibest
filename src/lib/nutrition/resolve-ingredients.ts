/**
 * Ingredient resolution — the DECIDE half of the Resolve / Compute seam.
 *
 * LLM-primary, single-pass resolution (ADR 0003 + ADR 0004):
 *   parse → ① canonicalize ALL names → search/rank/staple/guard → fetch
 *         → ② Stage-2 RAG select + portion + cooked/retention
 *         → ③ estimate macros for foods USDA does not carry → honest status.
 *
 * Decides, per ingredient, which food / how many grams / what retention / what
 * honest status — and hands back one `IngredientResolution` per ingredient. The
 * four batch calls (canonicalize, fetch, Stage 2, estimate) stay batched; the
 * progressive enrichment runs over ONE in-flight `ResolvingIngredient[]` whose
 * index-alignment to each batch result happens once, explicitly, per stage.
 *
 * Computing nutrition numbers from these records is the other half of the seam
 * (`compute.ts`). The pipeline degrades honestly (never throws garbage): a
 * flag-off / cache-miss / LLM-outage path matches on raw names and surfaces a
 * miss as UNRECOGNIZED.
 *
 * @module lib/nutrition/resolve-ingredients
 */
import {
  extractMacrosFromFood,
  foodHasEnergy,
  type FdcFood,
  type FdcSearchFood,
} from "@/lib/fdc";
import { resolveGramWeight } from "@/lib/gram-resolution";
import { getUnitKind } from "@/lib/unit-registry";
import { rankMatches, matchPlausible } from "@/lib/fdc-match";
import { stapleFdcId } from "@/lib/fdc-staples";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import { canonicalizeCached, getMacroEstimates } from "@/lib/ingredient-name-repo";
import { type MacroEstimate } from "@/lib/ingredient-canonicalizer";
import {
  parseIngredientLine,
  type ParsedIngredient,
} from "@/lib/ingredients";
import { runRecipeStage2 } from "@/lib/recipe-analysis-repo";
import {
  type RecipeAnalysis,
  type RecipeIngredientAnalysis,
} from "@/lib/recipe-analyzer";
import type {
  CanonicalOutcome,
  IngredientResolution,
  MatchRef,
  ResolutionTrace,
} from "./types";
import { createNutritionLogger, type NutritionLogger } from "./log";

/** How many top-ranked search candidates to keep per ingredient as fallbacks. */
const MAX_CANDIDATES_PER_INGREDIENT = 5;

/**
 * Output of the deterministic batch resolve for one ingredient: the chosen
 * deterministic food (or null), its gram weight, and the plausible candidate
 * foods offered to the Stage-2 LLM selector.
 */
interface BatchResolution {
  parsed: ParsedIngredient;
  bestMatch: FdcSearchFood | null;
  food: FdcFood | null;
  grams: number;
  confidence: number;
  note: string;
  /** Fetched, plausible candidate foods offered to the Stage-2 LLM selector. */
  candidates: FdcFood[];
}

/**
 * Private in-flight record. Progressively enriched across the batch stages, then
 * collapsed to the public `IngredientResolution` union by `finalize`. Callers
 * never see this — the messy intermediate state stays inside the resolver.
 */
interface ResolvingIngredient {
  /** Parsed ingredient, name = canonical when the LLM gave one, else raw. */
  parsed: ParsedIngredient;
  /** Three-state canonicalization outcome (name / not-food / unresolved). */
  canonical: CanonicalOutcome;
  /** LLM said this is not a food (genuine null). */
  notFood: boolean;
  /** Deterministic search/fetch/guard result. */
  batch: BatchResolution;
  /** Stage-2 per-ingredient decision (food selection + portion + cooked/retention). */
  s2?: RecipeIngredientAnalysis;
  /** The food finally chosen (LLM selection when on, else deterministic pick). */
  finalFood: FdcFood | null;
  /** Per-100g LLM macro estimate when no food could be selected, else null. */
  estimate: MacroEstimate | null;
}

/**
 * Grams for an ingredient: trust the LLM's portion estimate for count/household
 * units it can weigh better than the ladder (a roll, a clove); keep the
 * deterministic ladder for explicit weights (g/kg) and when no override exists.
 */
function gramsFor(
  parsed: ParsedIngredient,
  food: FdcFood | null,
  s2?: RecipeIngredientAnalysis
) {
  if (s2?.grams != null && getUnitKind(parsed.unit) !== "weight") {
    return { grams: s2.grams, confidence: s2.confidence, note: "LLM portion estimate" };
  }
  return resolveGramWeight(parsed, food);
}

function matchRef(f: FdcSearchFood | null): MatchRef | null {
  return f
    ? { fdcId: f.fdcId, description: f.description, dataType: f.dataType }
    : null;
}

/**
 * Resolve a list of ingredient lines to per-ingredient `IngredientResolution`
 * records plus the recipe-level Stage-2 analysis (diet/health labels live there).
 */
export async function resolveIngredients(
  ingredients: string[],
  title?: string,
  log: NutritionLogger = createNutritionLogger()
): Promise<{ resolutions: IngredientResolution[]; stage2: RecipeAnalysis }> {
  const rawParsed: ParsedIngredient[] = ingredients
    .filter((line) => line.trim().length > 0)
    .map((line) => parseIngredientLine(line));

  // ① Canonicalize every name once, up front (keyed by the raw parsed name).
  const canonical = await canonicalizeCached(rawParsed.map((p) => p.name));

  // Build the in-flight records: the match name is the canonical when the LLM
  // gave a different one, else the raw parsed name. The canonical outcome is
  // three-state — a name, a confirmed not-food (`null`), or an unresolved miss
  // (absent → match the raw name, never a confident not-food).
  const items: ResolvingIngredient[] = rawParsed.map((p) => {
    const c = canonical.get(p.name);
    const useCanonical = c != null && c.toLowerCase() !== p.name.toLowerCase();
    const outcome: CanonicalOutcome =
      c === undefined
        ? { kind: "unresolved" }
        : c === null
          ? { kind: "not-food" }
          : { kind: "name", value: c };
    return {
      parsed: useCanonical ? { ...p, name: c } : p,
      canonical: outcome,
      notFood: c === null,
      // filled by the deterministic batch resolve below
      batch: undefined as unknown as BatchResolution,
      s2: undefined,
      finalFood: null,
      estimate: null,
    };
  });

  log.debug(
    "canonical " +
      rawParsed
        .map((p) => {
          const c = canonical.get(p.name);
          const o =
            c === undefined ? "(unresolved)" : c === null ? "(not-food)" : c;
          return `${p.name}→${o}`;
        })
        .join(" · ")
  );

  // Deterministic batch resolve (search → rank → staple → fetch → guard → energy).
  const batch = await resolveBatch(items.map((it) => it.parsed));
  items.forEach((it, i) => {
    it.batch = batch[i];
  });

  // ② Stage 2 (RAG resolution, ADR 0004): hand the recipe + each ingredient's
  // fetched candidates (with per-100g macros) to the LLM, which selects the best
  // food, estimates portion grams for count/household units, and judges cooked/raw
  // + retention. Flag-gated → empty when off, so the pipeline falls back to the
  // deterministic pick + gram ladder (unchanged; keeps CI network-free).
  const stage2 = await runRecipeStage2({
    title,
    items: items.map((it) => ({
      line: it.parsed.original,
      qty: it.parsed.qty,
      unit: it.parsed.unit,
      name: it.parsed.name,
      candidates: it.batch.candidates.map((f) => {
        const macros = extractMacrosFromFood(f);
        return {
          fdcId: f.fdcId,
          description: f.description,
          dataType: f.dataType ?? "",
          kcal: macros.kcal,
          protein: macros.protein,
          fat: macros.fat,
          carbs: macros.carbs,
        };
      }),
    })),
  });

  // Food selection: flag-on → the LLM's chosen candidate (or null → estimate);
  // flag-off / Stage-2 failure → the deterministic pick from resolveBatch.
  // Stage-2 results align with `items` BY INDEX (one per input, in order).
  items.forEach((it, i) => {
    const s2 = stage2.perIngredient[i];
    it.s2 = s2;
    if (it.notFood) {
      it.finalFood = null;
      return;
    }
    if (s2) {
      it.finalFood =
        s2.chosenFdcId != null
          ? it.batch.candidates.find((f) => f.fdcId === s2.chosenFdcId) ?? null
          : null;
      return;
    }
    it.finalFood = it.batch.food;
  });

  // ③ Estimate per-100g macros for a food we could not select (and the LLM did
  // not call a non-food) — the last coverage step. Flag-off → empty map.
  const estimateIdx = items.flatMap((it, i) =>
    it.finalFood === null && !it.notFood ? [i] : []
  );
  const estimates = estimateIdx.length
    ? await getMacroEstimates(estimateIdx.map((i) => items[i].parsed.name))
    : new Map<string, MacroEstimate | null>();
  for (const i of estimateIdx) {
    items[i].estimate = estimates.get(items[i].parsed.name) ?? null;
  }

  const resolutions = items.map(finalize);

  log.debug(
    `stage2 ok=${resolutions.filter((r) => r.status === "OK").length} ` +
      `estimated=${resolutions.filter((r) => r.status === "ESTIMATED").length} ` +
      `labels=[${[...stage2.dietLabels, ...stage2.healthLabels].join(",")}]`
  );
  resolutions.forEach((r, i) => log.debug(`#${i + 1} ${describeResolution(r)}`));

  return { resolutions, stage2 };
}

/** One-line human-readable summary of a resolution, for the debug log. */
function describeResolution(r: IngredientResolution): string {
  const via = r.trace?.selectedVia ?? "?";
  switch (r.status) {
    case "OK":
      return `${r.parsed.name} → OK fdc ${r.food.fdcId} "${r.food.description}" ${Math.round(r.grams)}g via=${via} conf=${r.confidence}`;
    case "ESTIMATED":
      return `${r.parsed.name} → ESTIMATED ${Math.round(r.grams)}g via=${via}`;
    default:
      return `${r.parsed.name} → ${r.status} (${r.note}) via=${via}`;
  }
}

/**
 * Collapse one enriched in-flight record into the public discriminated union.
 * The LLM is authoritative on "not a food" — surface it even if free-text search
 * incidentally matched something. A food → OK; an estimate → ESTIMATED; neither →
 * UNRECOGNIZED (a flagged no-match, never a silent confident zero).
 */
function finalize(it: ResolvingIngredient): IngredientResolution {
  const { parsed, canonical, notFood, batch, s2, finalFood, estimate } = it;
  const candidateCount = batch.candidates.length;

  if (notFood) {
    return {
      status: "UNRECOGNIZED",
      source: "none",
      parsed,
      bestMatch: matchRef(batch.bestMatch),
      note: batch.note,
      canonical,
      trace: { selectedVia: "not-food", candidateCount },
    };
  }

  if (finalFood) {
    const g = gramsFor(parsed, finalFood, s2);
    return {
      status: "OK",
      source: "fdc",
      parsed,
      food: finalFood,
      grams: g.grams,
      confidence: g.confidence,
      note: g.note,
      // Retention adjusts micronutrients only (energy/macros conserved).
      retentionFactor: s2?.retentionFactor ?? 1,
      cookedState: s2?.cookedState,
      cookedFlagged: s2?.flagged,
      canonical,
      // `s2` present → the LLM selected the candidate; absent → deterministic pick.
      trace: { selectedVia: s2 ? "stage2-llm" : "deterministic", candidateCount },
    };
  }

  if (estimate) {
    const g = gramsFor(parsed, null, s2);
    return {
      status: "ESTIMATED",
      source: "llm_estimate",
      parsed,
      estimate,
      grams: g.grams,
      confidence: g.confidence,
      note: `LLM macro estimate (no USDA match); ${g.note}`,
      cookedState: s2?.cookedState,
      cookedFlagged: s2?.flagged,
      canonical,
      trace: { selectedVia: "estimate", candidateCount },
    };
  }

  return {
    status: "UNRECOGNIZED",
    source: "none",
    parsed,
    bestMatch: matchRef(batch.bestMatch),
    note: batch.note,
    cookedState: s2?.cookedState,
    cookedFlagged: s2?.flagged,
    canonical,
    trace: { selectedVia: "none", candidateCount },
  };
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
        candidates: [],
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
    // The plausible candidate foods, ranked — offered to the Stage-2 LLM selector.
    const plausibleFoods = plausible.map((c) => foodsById.get(c.fdcId)!);
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
        candidates: plausibleFoods,
      });
      continue;
    }

    const food = foodsById.get(hit.fdcId)!;
    const { grams, confidence, note } = resolveGramWeight(parsed, food);
    resolved.push({
      parsed,
      bestMatch: hit,
      food,
      grams,
      confidence,
      note,
      candidates: plausibleFoods,
    });
  }

  return resolved;
}
