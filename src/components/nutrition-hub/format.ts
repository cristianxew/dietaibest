import type { NutrientUnit } from "@/lib/nutrients/registry";

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
