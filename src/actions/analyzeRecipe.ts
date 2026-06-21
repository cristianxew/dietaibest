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
  scalePer100g,
  extractProfileFromFood,
  scaleProfilePer100g,
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

/**
 * Input parameters for recipe analysis
 */
export interface AnalyzeInput {
  /** Array of ingredient lines (one per line) */
  ingredients: string[];
  /** Number of servings the recipe yields */
  servings: number;
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
  /** Overall success status */
  success: boolean;
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Per-ingredient result for the full-profile pipeline. Carries the fields the
 * `RecipeIngredient` row needs (originalText/nameNorm/qty/unit/fdcId/grams/confidence).
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
}

/**
 * Complete full-profile (22-nutrient) recipe analysis result.
 */
export interface AnalyzeProfileResult {
  items: IngredientProfileResult[];
  total: Profile;
  perServing: Profile;
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
      return {
        items: [],
        total: zeroMacro(),
        perServing: zeroMacro(),
        success: false,
        error: "No ingredients provided",
      };
    }

    if (!servings || servings <= 0) {
      return {
        items: [],
        total: zeroMacro(),
        perServing: zeroMacro(),
        success: false,
        error: "Servings must be a positive number",
      };
    }

    if (ingredients.length > 100) {
      return {
        items: [],
        total: zeroMacro(),
        perServing: zeroMacro(),
        success: false,
        error: "Too many ingredients (max 100)",
      };
    }

    // Resolve FDC matches + gram weights via the shared pipeline
    const resolved = await resolveIngredientMatches(ingredients);

    const items: IngredientResult[] = [];
    let totalMacros = zeroMacro();

    for (const m of resolved) {
      const base = { original: m.parsed.original, name: m.parsed.name };

      if (!m.food) {
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
        continue;
      }

      const scaledMacros = scalePer100g(extractMacrosFromFood(m.food), m.grams);
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
      success: true,
    };
  } catch (error) {
    console.error("[analyzeRecipe] Unexpected error:", error);
    return {
      items: [],
      total: zeroMacro(),
      perServing: zeroMacro(),
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during analysis",
    };
  }
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
  parsed: ParsedIngredient;
  bestMatch: FdcSearchFood | null;
  food: FdcFood | null;
  grams: number;
  confidence: number;
  note: string;
}

async function resolveIngredientMatches(
  ingredients: string[]
): Promise<ResolvedIngredientMatch[]> {
  const parsed: ParsedIngredient[] = ingredients
    .filter((line) => line.trim().length > 0)
    .map((line) => parseIngredientLine(line));

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

  const resolved: ResolvedIngredientMatch[] = [];
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
    const hit = fetchable.find(
      (c) =>
        c.fdcId === staple ||
        matchPlausible(foodsById.get(c.fdcId)!.description, parsed.name)
    );
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
    const { ingredients, servings } = input;

    if (!ingredients || ingredients.length === 0) {
      return {
        items: [],
        total: zeroProfile(),
        perServing: zeroProfile(),
        success: false,
        error: "No ingredients provided",
      };
    }

    if (!servings || servings <= 0) {
      return {
        items: [],
        total: zeroProfile(),
        perServing: zeroProfile(),
        success: false,
        error: "Servings must be a positive number",
      };
    }

    if (ingredients.length > 100) {
      return {
        items: [],
        total: zeroProfile(),
        perServing: zeroProfile(),
        success: false,
        error: "Too many ingredients (max 100)",
      };
    }

    const resolved = await resolveIngredientMatches(ingredients);

    const items: IngredientProfileResult[] = [];
    let total = zeroProfile();

    for (const m of resolved) {
      const base = {
        original: m.parsed.original,
        name: m.parsed.name,
        nameNorm: m.parsed.name,
        qty: m.parsed.qty,
        unit: m.parsed.unit,
      };

      if (!m.food) {
        items.push({
          ...base,
          fdcId: m.bestMatch?.fdcId ?? null,
          description: m.bestMatch?.description ?? null,
          gramsTotal: 0,
          confidence: 0,
          portionNote: m.note,
          dataType: m.bestMatch?.dataType ?? null,
        });
        continue;
      }

      const scaled = scaleProfilePer100g(extractProfileFromFood(m.food), m.grams);
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
    }

    const perServing = divideProfile(total, servings);

    return { items, total, perServing, success: true };
  } catch (error) {
    console.error("[analyzeRecipeProfile] Unexpected error:", error);
    return {
      items: [],
      total: zeroProfile(),
      perServing: zeroProfile(),
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected error occurred during analysis",
    };
  }
}
