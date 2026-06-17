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

export interface GramResolution {
  /** Total grams for the ingredient (qty already applied). */
  grams: number;
  /** How trustworthy the resolution is, 0–1. */
  confidence: number;
  /** Human-readable explanation of which strategy resolved the weight. */
  note: string;
}

/**
 * Generic, ingredient-agnostic conversions. The last resort before assuming the
 * quantity is grams — volume units here assume a water-like density, so they are
 * only reached when neither USDA portions nor the density table know the
 * ingredient. Expanding the density table shrinks how often this fires.
 */
const GENERIC_CONVERSIONS_G_PER_UNIT: Record<string, number> = {
  oz: 28.35,
  lb: 453.6,
  kg: 1000,
  ml: 1,
  l: 1000,
  cup: 240,
  tbsp: 15,
  tsp: 5,
  pint: 473,
  quart: 946,
  gallon: 3785,
};

const round = (n: number) => Math.round(n * 100) / 100;

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
 * 5. Generic water-density conversion (0.5)
 * 6. Assume the quantity is grams (0.3)
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

  // 5. Generic conversion (assumes water-like density for volume units).
  const generic = GENERIC_CONVERSIONS_G_PER_UNIT[unit];
  if (generic !== undefined) {
    return {
      grams: qty * generic,
      confidence: 0.5,
      note: `Generic conversion: ${generic}g per ${unit}`,
    };
  }

  // 6. Last resort: assume the quantity is grams.
  return {
    grams: qty,
    confidence: 0.3,
    note: `Assumed ${qty} ${unit} = ${qty}g (low confidence)`,
  };
}
