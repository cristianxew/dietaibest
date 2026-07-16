/**
 * Nutrition computation — the COMPUTE half of the Resolve / Compute seam.
 *
 * Pure: turns the per-ingredient `IngredientResolution` records into nutrition
 * numbers — scale per-100g to grams, apply retention to micronutrients only
 * (profile path), aggregate, and roll up the honest coverage summary. No I/O, no
 * decisions — those all happened in `resolve-ingredients.ts`.
 *
 * The two paths (full `Profile` vs the 5-macro `Macro`) share the record walk and
 * the metadata/coverage build, but each keeps its own leaf extraction:
 * `extractProfileFromFood` runs a unit-validation `extractMacrosFromFood` does
 * not, so they are NOT interchangeable — collapsing them is a behaviour change,
 * deliberately out of scope here.
 *
 * @module lib/nutrition/compute
 */
import {
  extractMacrosFromFood,
  scalePer100g,
  extractProfileFromFood,
  scaleProfileWithRetention,
  scaleProfilePer100g,
  profileFromMacroEstimate,
  addProfile,
  divideProfile,
  zeroProfile,
  type Macro,
  type Profile,
} from "@/lib/fdc";
import type {
  IngredientResolution,
  IngredientResult,
  IngredientProfileResult,
  IngredientStatus,
  CoverageSummary,
} from "./types";

function zeroMacro(): Macro {
  return { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
}

function addMacros(a: Macro, b: Macro): Macro {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    fat: a.fat + b.fat,
    carbs: a.carbs + b.carbs,
    fiber: a.fiber + b.fiber,
  };
}

function divideMacros(m: Macro, divisor: number): Macro {
  return {
    kcal: m.kcal / divisor,
    protein: m.protein / divisor,
    fat: m.fat / divisor,
    carbs: m.carbs / divisor,
    fiber: m.fiber / divisor,
  };
}

/** Project the 5 macros out of a full profile (the macro path is a view of it). */
export function macroFromProfile(p: Profile): Macro {
  return {
    kcal: p.calories,
    protein: p.protein,
    fat: p.fat,
    carbs: p.carbs,
    fiber: p.fiber,
  };
}

/** Roll per-ingredient statuses up into the recipe coverage summary. */
export function summarize(items: { status: IngredientStatus }[]): CoverageSummary {
  return {
    total: items.length,
    resolved: items.filter((i) => i.status === "OK").length,
    estimated: items.filter((i) => i.status === "ESTIMATED").length,
    unrecognized: items.filter(
      (i) => i.status === "UNRECOGNIZED" || i.status === "MISSING_QTY"
    ).length,
  };
}

/**
 * Compute the full 22-nutrient profile from resolution records. Stage-2 retention
 * applies to micronutrients only; energy + macros are conserved, and reported
 * grams stay raw-as-entered (ADR 0003).
 */
export function computeProfile(
  resolutions: IngredientResolution[],
  servings: number
): {
  items: IngredientProfileResult[];
  total: Profile;
  perServing: Profile;
  coverage: CoverageSummary;
} {
  const items: IngredientProfileResult[] = [];
  let total = zeroProfile();

  for (const r of resolutions) {
    const base = {
      original: r.parsed.original,
      name: r.parsed.name,
      nameNorm: r.parsed.name,
      qty: r.parsed.qty,
      unit: r.parsed.unit,
      status: r.status,
      source: r.source,
      cookedState: r.cookedState,
      cookedFlagged: r.cookedFlagged,
    };

    if (r.status === "OK") {
      const scaled = scaleProfileWithRetention(
        extractProfileFromFood(r.food),
        r.grams,
        r.retentionFactor
      );
      items.push({
        ...base,
        fdcId: r.food.fdcId,
        description: r.food.description,
        gramsTotal: r.grams,
        confidence: r.confidence,
        portionNote: r.note,
        dataType: r.food.dataType,
        macros: macroFromProfile(scaled),
      });
      total = addProfile(total, scaled);
      continue;
    }

    if (r.status === "ESTIMATED") {
      // Counted but flagged (ADR 0003): only the 5 macros are known; micros 0.
      const scaled = scaleProfilePer100g(
        profileFromMacroEstimate(r.estimate),
        r.grams
      );
      items.push({
        ...base,
        fdcId: null,
        description: null,
        gramsTotal: r.grams,
        confidence: r.confidence,
        portionNote: r.note,
        dataType: null,
        macros: macroFromProfile(scaled),
      });
      total = addProfile(total, scaled);
      continue;
    }

    // UNRECOGNIZED / MISSING_QTY: surfaced, contributes 0.
    items.push({
      ...base,
      fdcId: r.bestMatch?.fdcId ?? null,
      description: r.bestMatch?.description ?? null,
      gramsTotal: 0,
      confidence: 0,
      portionNote: r.note,
      dataType: r.bestMatch?.dataType ?? null,
      macros: zeroMacro(),
    });
  }

  return {
    items,
    total,
    perServing: divideProfile(total, servings),
    coverage: summarize(items),
  };
}

/**
 * Compute the 5 macros from resolution records. Macros are conserved by cooking,
 * so the Stage-2 retention factor does NOT apply on the macro path.
 */
export function computeMacros(
  resolutions: IngredientResolution[],
  servings: number
): {
  items: IngredientResult[];
  total: Macro;
  perServing: Macro;
  coverage: CoverageSummary;
} {
  const items: IngredientResult[] = [];
  let total = zeroMacro();

  for (const r of resolutions) {
    const base = {
      original: r.parsed.original,
      name: r.parsed.name,
      status: r.status,
      source: r.source,
      cookedState: r.cookedState,
      cookedFlagged: r.cookedFlagged,
    };

    if (r.status === "OK") {
      const scaledMacros = scalePer100g(extractMacrosFromFood(r.food), r.grams);
      items.push({
        ...base,
        fdcId: r.food.fdcId,
        description: r.food.description,
        gramsTotal: r.grams,
        macros: scaledMacros,
        confidence: r.confidence,
        portionNote: r.note,
        dataType: r.food.dataType,
      });
      total = addMacros(total, scaledMacros);
      continue;
    }

    if (r.status === "ESTIMATED") {
      // The MacroEstimate is per-100g and shares Macro's shape; scale by grams.
      const scaledMacros = scalePer100g(r.estimate, r.grams);
      items.push({
        ...base,
        fdcId: null,
        description: null,
        gramsTotal: r.grams,
        macros: scaledMacros,
        confidence: r.confidence,
        portionNote: r.note,
        dataType: null,
      });
      total = addMacros(total, scaledMacros);
      continue;
    }

    // UNRECOGNIZED / MISSING_QTY — surfaced, contributes 0.
    items.push({
      ...base,
      fdcId: r.bestMatch?.fdcId ?? null,
      description: r.bestMatch?.description ?? null,
      gramsTotal: 0,
      macros: zeroMacro(),
      confidence: 0,
      portionNote: r.note,
      dataType: r.bestMatch?.dataType ?? null,
    });
  }

  return {
    items,
    total,
    perServing: divideMacros(total, servings),
    coverage: summarize(items),
  };
}
