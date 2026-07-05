/**
 * Extended nutrient extraction from FDC food payloads.
 *
 * A NutrientVector is SPARSE: a missing key means "unknown", never zero.
 * That distinction drives honest UI (em-dash instead of 0) and keeps the
 * insights engine from awarding wins on absent data.
 *
 * Pure module — mirrors the dual-format handling of `extractMacrosFromFood`
 * in lib/fdc.ts without touching it.
 *
 * @module lib/nutrients/extract
 */

import type { FdcFood } from "@/lib/fdc";
import {
  NUTRIENT_REGISTRY,
  type NutrientKey,
} from "@/lib/nutrients/registry";

/** Sparse per-100g nutrient amounts. Missing key = unknown, NOT zero. */
export type NutrientVector = Partial<Record<NutrientKey, number>>;

/** USDA nutrient number → registry key, built once at module load. */
const KEY_BY_USDA_NUMBER: ReadonlyMap<string, NutrientKey> = new Map(
  Object.values(NUTRIENT_REGISTRY).flatMap((def) =>
    def.usdaNumbers.map((num) => [num, def.key] as const)
  )
);

/**
 * Extract all registry nutrients from an FDC food object.
 * Handles both payload shapes: full (`nutrient.number`) and abridged
 * (`nutrientNumber`). First occurrence of a nutrient wins.
 */
export function extractNutrientVector(food: FdcFood): NutrientVector {
  const vector: NutrientVector = {};

  for (const fn of food.foodNutrients ?? []) {
    const num = fn.nutrient?.number ?? fn.nutrientNumber;
    if (!num || typeof fn.amount !== "number") continue;

    const key = KEY_BY_USDA_NUMBER.get(String(num));
    if (key && vector[key] === undefined) {
      vector[key] = fn.amount;
    }
  }

  return vector;
}

/** Scale every present amount by `factor`. Absent keys stay absent. */
export function scaleVector(v: NutrientVector, factor: number): NutrientVector {
  const out: NutrientVector = {};
  for (const [key, amount] of Object.entries(v) as [NutrientKey, number][]) {
    out[key] = amount * factor;
  }
  return out;
}

/** Union sum: keys present in either vector appear; present in both → added. */
export function addVectors(a: NutrientVector, b: NutrientVector): NutrientVector {
  const out: NutrientVector = { ...a };
  for (const [key, amount] of Object.entries(b) as [NutrientKey, number][]) {
    out[key] = (out[key] ?? 0) + amount;
  }
  return out;
}
