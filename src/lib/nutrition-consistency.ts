/**
 * Sanity checks between a recipe's stored calories and its macros.
 *
 * Some recipes carry per-serving calories that contradict their own macros
 * (legacy rows written before the FDC Atwater-energy fix in `src/lib/fdc.ts`).
 * The data is left alone; the UI flags these so the user can re-analyze them.
 */

/** Atwater general factors: kcal per gram of protein, carbohydrate and fat. */
export const ATWATER_KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Calories may differ from the macro estimate by up to this share of the larger value. */
const RELATIVE_TOLERANCE = 0.25;
/** ...and by up to this many kcal, so small recipes don't trip the relative check. */
const ABSOLUTE_TOLERANCE_KCAL = 40;

export interface NutritionFacts {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

/** Energy implied by the macros (4P + 4C + 9F); missing macros count as 0 g. */
export function atwaterCalories({ protein, carbs, fat }: NutritionFacts): number {
  return (
    (protein ?? 0) * ATWATER_KCAL_PER_GRAM.protein +
    (carbs ?? 0) * ATWATER_KCAL_PER_GRAM.carbs +
    (fat ?? 0) * ATWATER_KCAL_PER_GRAM.fat
  );
}

/**
 * True when the stored calories contradict the macros: calories are positive
 * and differ from the Atwater estimate by more than 25% of the larger of the
 * two AND by more than 40 kcal. Returns false when there is nothing to compare
 * (no calories, or no macro values at all).
 */
export function hasCalorieMacroMismatch(facts: NutritionFacts): boolean {
  const calories = facts.calories ?? 0;
  if (!(calories > 0)) return false;
  if (facts.protein == null && facts.carbs == null && facts.fat == null) return false;

  const estimate = atwaterCalories(facts);
  const difference = Math.abs(calories - estimate);
  return (
    difference > RELATIVE_TOLERANCE * Math.max(calories, estimate) &&
    difference > ABSOLUTE_TOLERANCE_KCAL
  );
}
