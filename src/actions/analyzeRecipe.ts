/**
 * Recipe Analysis Server Action
 * Orchestrates complete nutrition analysis pipeline from ingredient lines to macros
 *
 * @module actions/analyzeRecipe
 */

"use server";

import {
  parseIngredientLine,
  DENSITY_FALLBACK_G_PER_UNIT,
  type ParsedIngredient,
} from "@/lib/ingredients";
import {
  fdcSearch,
  extractMacrosFromFood,
  scalePer100g,
  resolveGramWeightFromPortions,
  extractBrandedServing,
  DATATYPE_PRIORITY,
  type Macro,
  type FdcFood,
  type FdcSearchFood,
} from "@/lib/fdc";
import { getFoodsCached } from "@/lib/fdcRepo";

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

/**
 * Choose best FDC match based on data type priority
 * Foundation > Survey (FNDDS) > SR Legacy > Branded
 */
function chooseBestMatch(foods: FdcSearchFood[]): FdcSearchFood | null {
  if (!foods.length) return null;

  // Sort by priority
  const sorted = [...foods].sort((a, b) => {
    const aIdx = DATATYPE_PRIORITY.indexOf(
      a.dataType as (typeof DATATYPE_PRIORITY)[number]
    );
    const bIdx = DATATYPE_PRIORITY.indexOf(
      b.dataType as (typeof DATATYPE_PRIORITY)[number]
    );
    const aPri = aIdx === -1 ? 999 : aIdx;
    const bPri = bIdx === -1 ? 999 : bIdx;
    return aPri - bPri;
  });

  return sorted[0];
}

/**
 * Resolve gram weight for an ingredient using multiple strategies
 * Returns { grams, confidence, note }
 */
async function resolveGramWeight(
  parsed: ParsedIngredient,
  food: FdcFood
): Promise<{ grams: number; confidence: number; note: string }> {
  const { qty, unit, name } = parsed;

  // Strategy 1: If unit is already grams, use directly
  if (unit === "g" || unit === "gram" || unit === "grams") {
    return {
      grams: qty,
      confidence: 1.0,
      note: "Direct gram measurement",
    };
  }

  // Strategy 2: Try resolving from FDC food portions
  const portionGrams = resolveGramWeightFromPortions(food, unit);
  if (portionGrams !== null) {
    return {
      grams: qty * portionGrams,
      confidence: 0.9,
      note: `USDA portion: ${portionGrams}g per ${unit}`,
    };
  }

  // Strategy 3: Try branded serving info (for branded foods)
  if (food.dataType === "Branded") {
    const branded = extractBrandedServing(food);
    if (branded.gramsPerServing !== null) {
      // Assume "piece" or "serving" maps to one branded serving
      if (unit === "piece" || unit === "serving" || unit === "package") {
        return {
          grams: qty * branded.gramsPerServing,
          confidence: 0.85,
          note: `Branded serving: ${branded.gramsPerServing}g per serving`,
        };
      }
    }
  }

  // Strategy 4: Try density fallback lookup
  const densityKey = name.toLowerCase();
  if (DENSITY_FALLBACK_G_PER_UNIT[densityKey]) {
    const gramsPerUnit = DENSITY_FALLBACK_G_PER_UNIT[densityKey][unit];
    if (gramsPerUnit !== undefined) {
      return {
        grams: qty * gramsPerUnit,
        confidence: 0.7,
        note: `Density fallback: ${gramsPerUnit}g per ${unit}`,
      };
    }
  }

  // Strategy 5: Try partial name match in density fallback
  for (const [key, units] of Object.entries(DENSITY_FALLBACK_G_PER_UNIT)) {
    if (densityKey.includes(key) || key.includes(densityKey)) {
      const gramsPerUnit = units[unit];
      if (gramsPerUnit !== undefined) {
        return {
          grams: qty * gramsPerUnit,
          confidence: 0.6,
          note: `Density fallback (partial match "${key}"): ${gramsPerUnit}g per ${unit}`,
        };
      }
    }
  }

  // Strategy 6: Common volume/weight conversions
  const commonConversions: Record<string, number> = {
    oz: 28.35,
    lb: 453.6,
    kg: 1000,
    ml: 1, // assume water density
    l: 1000,
    cup: 240, // assume water/liquid density
    tbsp: 15,
    tsp: 5,
    pint: 473,
    quart: 946,
    gallon: 3785,
  };

  if (commonConversions[unit]) {
    return {
      grams: qty * commonConversions[unit],
      confidence: 0.5,
      note: `Generic conversion: ${commonConversions[unit]}g per ${unit}`,
    };
  }

  // Strategy 7: Last resort - assume qty is in grams
  console.warn(
    `[analyzeRecipe] Could not resolve unit "${unit}" for "${name}", assuming quantity is grams`
  );
  return {
    grams: qty,
    confidence: 0.3,
    note: `Assumed ${qty} ${unit} = ${qty}g (low confidence)`,
  };
}

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

    // Step 1: Parse all ingredient lines
    console.log(`[analyzeRecipe] Parsing ${ingredients.length} ingredients`);
    const parsed: ParsedIngredient[] = ingredients
      .filter((line) => line.trim().length > 0)
      .map((line) => parseIngredientLine(line));

    // Step 2: Search USDA FDC for each ingredient name (parallel)
    console.log("[analyzeRecipe] Searching USDA FDC for ingredients");
    const searchResults = await Promise.all(
      parsed.map(async (p) => {
        try {
          const result = await fdcSearch(p.name);
          return { parsed: p, foods: result.foods || [] };
        } catch (error) {
          console.error(
            `[analyzeRecipe] Search failed for "${p.name}":`,
            error
          );
          return { parsed: p, foods: [] };
        }
      })
    );

    // Step 3: Choose best match per ingredient using DATATYPE_PRIORITY
    const matches = searchResults.map(({ parsed, foods }) => ({
      parsed,
      bestMatch: chooseBestMatch(foods),
    }));

    // Step 4: Batch fetch full food details via getFoodsCached
    const fdcIds = matches
      .map((m) => m.bestMatch?.fdcId)
      .filter((id): id is number => id !== undefined && id !== null);

    console.log(
      `[analyzeRecipe] Fetching ${fdcIds.length} foods from cache/API`
    );
    const foodsDetailed = await getFoodsCached(fdcIds);
    const foodsById = new Map<number, FdcFood>();
    for (const food of foodsDetailed) {
      foodsById.set(food.fdcId, food);
    }

    // Step 5-7: Process each ingredient
    const items: IngredientResult[] = [];
    let totalMacros = zeroMacro();

    for (const { parsed, bestMatch } of matches) {
      if (!bestMatch) {
        // No FDC match found
        items.push({
          original: parsed.original,
          name: parsed.name,
          fdcId: null,
          description: null,
          gramsTotal: 0,
          macros: zeroMacro(),
          confidence: 0,
          portionNote: "No USDA match found",
          dataType: null,
        });
        continue;
      }

      const food = foodsById.get(bestMatch.fdcId);
      if (!food) {
        // Food was in search results but not in detailed fetch (shouldn't happen)
        items.push({
          original: parsed.original,
          name: parsed.name,
          fdcId: bestMatch.fdcId,
          description: bestMatch.description,
          gramsTotal: 0,
          macros: zeroMacro(),
          confidence: 0,
          portionNote: "Failed to fetch food details",
          dataType: bestMatch.dataType,
        });
        continue;
      }

      // Step 5: Resolve gram weight
      const { grams, confidence, note } = await resolveGramWeight(parsed, food);

      // Step 6: Extract per-100g macros and scale to actual grams
      const per100g = extractMacrosFromFood(food);
      const scaledMacros = scalePer100g(per100g, grams);

      // Step 7: Compute confidence and aggregate
      items.push({
        original: parsed.original,
        name: parsed.name,
        fdcId: food.fdcId,
        description: food.description,
        gramsTotal: grams,
        macros: scaledMacros,
        confidence,
        portionNote: note,
        dataType: food.dataType,
      });

      totalMacros = addMacros(totalMacros, scaledMacros);
    }

    // Step 8-9: Calculate per-serving macros
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
