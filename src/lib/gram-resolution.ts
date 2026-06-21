/**
 * Ingredient → grams resolution ladder.
 *
 * Pure, FDC-payload-aware logic for turning a parsed ingredient (qty + unit +
 * name) into a gram weight, with a confidence score and a human-readable note.
 * Extracted from the recipe-analysis server action so it can be unit-tested in
 * isolation. Strategies run most-accurate first; the resolved confidence
 * reflects which one fired.
 *
 * @module lib/gram-resolution
 */

import {
  type FdcFood,
  resolveGramWeightFromPortions,
  extractBrandedServing,
} from "./fdc";
import { DENSITY_FALLBACK_G_PER_UNIT, type ParsedIngredient } from "./ingredients";
import { getUnitDefinition } from "./unit-registry";

export interface GramResolution {
  /** Total grams for the ingredient (qty already applied). */
  grams: number;
  /** How trustworthy the resolution is, 0–1. */
  confidence: number;
  /** Human-readable explanation of which strategy resolved the weight. */
  note: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Typical weight (grams) for a single count unit, used when no ingredient
 * portion or density entry resolved it. Rough by nature — but a sensible
 * estimate beats the old "assume 1 unit = 1 gram" last resort, which silently
 * zeroed the nutrition of canned/packaged/bunched ingredients.
 *
 * `piece` is deliberately omitted: a "piece" of an unknown ingredient has no
 * meaningful default and stays handled by the ingredient-specific density table.
 */
const COUNT_UNIT_DEFAULT_GRAMS: Record<string, number> = {
  can: 400,
  package: 250,
  box: 300,
  bunch: 150,
  stick: 113,
  slice: 25,
  clove: 3,
  pinch: 0.36,
  dash: 0.6,
};

/**
 * Find the density-table entry for an ingredient name.
 *
 * Exact key match wins. Otherwise the longest whole-word match wins, so
 * "extra virgin olive oil" resolves to "olive oil" rather than the generic
 * "oil", and "bell pepper" never collapses onto the "pepper" spice (which is a
 * substring but not a whole word of "bell pepper" — the previous `includes`
 * matcher got this wrong).
 */
function findDensityEntry(
  name: string
): { key: string; units: Record<string, number>; exact: boolean } | null {
  const lower = name.toLowerCase().trim();

  // Exact match, then a naive singular of the whole name ("chickpeas" →
  // "chickpea", "lentils" → "lentil") so the table can hold singular keys.
  const exactCandidates = [lower];
  if (lower.endsWith("s")) exactCandidates.push(lower.replace(/s$/, ""));
  for (const candidate of exactCandidates) {
    if (DENSITY_FALLBACK_G_PER_UNIT[candidate]) {
      return {
        key: candidate,
        units: DENSITY_FALLBACK_G_PER_UNIT[candidate],
        exact: true,
      };
    }
  }

  let best: { key: string; units: Record<string, number> } | null = null;
  for (const [key, units] of Object.entries(DENSITY_FALLBACK_G_PER_UNIT)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`).test(lower)) {
      if (!best || key.length > best.key.length) best = { key, units };
    }
  }
  return best ? { ...best, exact: false } : null;
}

/**
 * Resolve the gram weight for one parsed ingredient against its matched FDC
 * food, trying strategies from most to least accurate:
 *
 * 1. Direct grams (confidence 1.0)
 * 2. USDA structured food portions (0.9)
 * 3. Branded per-serving weight for piece/serving/package units (0.85)
 * 4. Density fallback table — exact (0.7) or whole-word (0.6)
 * 5. Count-unit default weight (0.4)
 * 6. Generic water-density conversion (0.5)
 * 7. Assume the quantity is grams (0.3)
 */
export function resolveGramWeight(
  parsed: ParsedIngredient,
  food: FdcFood
): GramResolution {
  const { qty, unit, name } = parsed;

  // 1. Already grams.
  if (unit === "g" || unit === "gram" || unit === "grams") {
    return { grams: qty, confidence: 1.0, note: "Direct gram measurement" };
  }

  // 2. USDA food portions (preferred — real measured weights).
  const portionGrams = resolveGramWeightFromPortions(food, unit);
  if (portionGrams !== null) {
    return {
      grams: qty * portionGrams,
      confidence: 0.9,
      note: `USDA portion: ${round(portionGrams)}g per ${unit}`,
    };
  }

  // 3. Branded serving weight (a "piece"/"serving"/"package" of a branded food).
  if (food.dataType === "Branded") {
    const branded = extractBrandedServing(food);
    if (
      branded.gramsPerServing !== null &&
      (unit === "piece" || unit === "serving" || unit === "package")
    ) {
      return {
        grams: qty * branded.gramsPerServing,
        confidence: 0.85,
        note: `Branded serving: ${branded.gramsPerServing}g per serving`,
      };
    }
  }

  // 4. Density fallback table.
  const density = findDensityEntry(name);
  if (density) {
    const gramsPerUnit = density.units[unit];
    if (gramsPerUnit !== undefined) {
      return {
        grams: qty * gramsPerUnit,
        confidence: density.exact ? 0.7 : 0.6,
        note: density.exact
          ? `Density fallback: ${gramsPerUnit}g per ${unit}`
          : `Density fallback (matched "${density.key}"): ${gramsPerUnit}g per ${unit}`,
      };
    }
  }

  // 5. Count-unit default weight. Count units (can/package/bunch/…) have no
  //    universal volume, so when the density table didn't cover this ingredient
  //    we fall back to a typical per-unit weight. Rough, but far better than the
  //    assume-1g last resort that used to zero out canned/packaged ingredients.
  const countDefault = COUNT_UNIT_DEFAULT_GRAMS[unit];
  if (countDefault !== undefined) {
    return {
      grams: qty * countDefault,
      confidence: 0.4,
      note: `Count default: ${countDefault}g per ${unit}`,
    };
  }

  // 6. Generic conversion via the unit registry. Weight units convert straight
  //    to grams; volume units convert to millilitres and assume a water-like
  //    density (1 g/ml). Count units have no universal weight (toBase === null)
  //    so they skip this and fall through. Fires only when neither USDA portions
  //    nor the density table knew the ingredient.
  const def = getUnitDefinition(unit);
  if (def && def.toBase !== null) {
    const gramsPerUnit = def.toBase; // grams (weight) or ml-as-grams (volume)
    return {
      grams: qty * gramsPerUnit,
      confidence: 0.5,
      note: `Generic conversion: ${round(gramsPerUnit)}g per ${unit}`,
    };
  }

  // 7. Last resort: assume the quantity is grams.
  return {
    grams: qty,
    confidence: 0.3,
    note: `Assumed ${qty} ${unit} = ${qty}g (low confidence)`,
  };
}
