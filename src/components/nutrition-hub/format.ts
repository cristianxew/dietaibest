import type { NutrientUnit } from "@/lib/nutrients/registry";

/**
 * Friendly short name from a USDA description.
 * "Nuts, almonds" → "Nuts, almonds" (generic first segment keeps its
 * one-word qualifier), "Bananas, raw" → "Bananas",
 * "Oats (Includes foods for...)" → "Oats".
 */
export function foodShortName(description: string): string {
  const clean = description.replace(/\s*\([^)]*\)/g, "").trim();
  const segments = clean
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length <= 1) return segments[0] ?? clean;

  const [first, second] = segments;
  const qualifierFits =
    first.length <= 8 &&
    /^[A-Za-z]+$/.test(second) &&
    second.toLowerCase() !== "raw";

  return qualifierFits ? `${first}, ${second}` : first;
}

/** "ug" → "µg" for display; other units pass through. */
export function displayUnit(unit: NutrientUnit): string {
  return unit === "ug" ? "µg" : unit;
}

/** Round for display: integers from 10 up, 1 decimal below. */
export function formatNutrientAmount(value: number, unit: NutrientUnit): string {
  const rounded =
    value >= 10 || unit === "kcal"
      ? Math.round(value)
      : Math.round(value * 10) / 10;
  return `${rounded} ${displayUnit(unit)}`;
}
