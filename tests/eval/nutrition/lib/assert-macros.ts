/**
 * Pure assertion logic for the golden-recipe nutrition harness.
 *
 * Two layers:
 * - `compareMacros` — per-macro relative-tolerance check against a trusted
 *   expected value, with tier-specific tolerances (anchor = tight,
 *   hand-verified FDC truth; real = loose, published labels).
 * - `checkInvariants` — structural plausibility checks that must hold for ANY
 *   recipe regardless of a trusted expectation. These are the same invariants a
 *   future Capa 1 runtime sanity gate would enforce.
 *
 * Kept dependency-free (only the `Profile` shape from `@/lib/fdc`) so it is
 * trivially unit-testable and reusable.
 *
 * @module tests/eval/nutrition/lib/assert-macros
 */

import { type Profile, PROFILE_NUTRIENT_MAP } from "@/lib/fdc";

export type MacroField = "calories" | "protein" | "fat" | "carbs" | "fiber";
export type Tier = "anchor" | "real";

/** Trusted macros. Fields may be omitted (e.g. labels often lack fiber). */
export type MacroExpectation = Partial<Record<MacroField, number>>;

export interface MacroComparison {
  field: MacroField;
  actual: number;
  expected: number;
  /** |actual − expected| / |expected| (0 when both are 0, Infinity when only expected is 0). */
  relError: number;
  /** Allowed relative tolerance for this field + tier. */
  tolerance: number;
  ok: boolean;
}

export interface InvariantViolation {
  code: string;
  detail: string;
}

const MACRO_FIELDS: MacroField[] = [
  "calories",
  "protein",
  "fat",
  "carbs",
  "fiber",
];

/**
 * Relative tolerances per tier. Anchor truth is a hand-verified FDC computation
 * so we hold it tight; real-world truth comes from third-party labels whose
 * engine differs from FDC, so it only needs to catch gross failure. Fiber is
 * the noisiest field in both worlds.
 */
export const TOLERANCES: Record<Tier, Record<MacroField, number>> = {
  anchor: { calories: 0.1, protein: 0.15, fat: 0.15, carbs: 0.15, fiber: 0.25 },
  real: { calories: 0.25, protein: 0.35, fat: 0.35, carbs: 0.35, fiber: 0.5 },
};

/** Relative error, defined so 0-vs-0 passes and "expected 0, got >0" fails. */
function relError(actual: number, expected: number): number {
  if (expected === 0) return actual === 0 ? 0 : Infinity;
  return Math.abs(actual - expected) / Math.abs(expected);
}

export function compareMacros(
  actual: Pick<Profile, MacroField>,
  expected: MacroExpectation,
  tier: Tier
): MacroComparison[] {
  return MACRO_FIELDS.filter((field) => expected[field] !== undefined).map(
    (field) => {
      const tolerance = TOLERANCES[tier][field];
      const exp = expected[field]!;
      const err = relError(actual[field], exp);
      return {
        field,
        actual: actual[field],
        expected: exp,
        relError: err,
        tolerance,
        ok: err <= tolerance,
      };
    }
  );
}

export function macrosPass(comparisons: MacroComparison[]): boolean {
  return comparisons.every((c) => c.ok);
}

export interface ProfileResultLike {
  success: boolean;
  total: Profile;
  perServing: Profile;
  items: ReadonlyArray<{ fdcId: number | null; gramsTotal: number }>;
}

/** Physical ceiling for energy density: pure fat is ~9 kcal/g; allow headroom. */
const MAX_KCAL_PER_GRAM = 9.5;

const PROFILE_FIELDS = Object.keys(PROFILE_NUTRIENT_MAP) as (keyof Profile)[];

/**
 * Structural plausibility checks that hold for any recipe. Returns one
 * `InvariantViolation` per problem found (empty array = all good).
 */
export function checkInvariants(
  result: ProfileResultLike,
  servings: number
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (!result.success) {
    violations.push({ code: "analysis-failed", detail: "success was false" });
  }

  // No NaN / negative nutrient values anywhere.
  for (const where of ["total", "perServing"] as const) {
    const profile = result[where];
    for (const field of PROFILE_FIELDS) {
      const v = profile[field];
      if (!Number.isFinite(v) || v < 0) {
        violations.push({
          code: "negative-or-nan",
          detail: `${where}.${String(field)} = ${v}`,
        });
      }
    }
  }

  // perServing × servings must reconstruct total (the pipeline divides total by
  // servings, so this is float-tight in the happy path).
  for (const field of PROFILE_FIELDS) {
    const total = result.total[field];
    const reconstructed = result.perServing[field] * servings;
    const allowed = Math.max(Math.abs(total) * 0.01, 1e-6);
    if (Number.isFinite(total) && Math.abs(reconstructed - total) > allowed) {
      violations.push({
        code: "inconsistent-division",
        detail: `${String(field)}: perServing×${servings}=${reconstructed} vs total=${total}`,
      });
    }
  }

  // Recipe-level energy density must be physically plausible.
  const totalGrams = result.items.reduce((sum, it) => sum + it.gramsTotal, 0);
  if (totalGrams > 0) {
    const density = result.total.calories / totalGrams;
    if (density > MAX_KCAL_PER_GRAM) {
      violations.push({
        code: "implausible-kcal-density",
        detail: `${density.toFixed(2)} kcal/g over ${totalGrams} g`,
      });
    }
  }

  // An ingredient matched to a food but resolved to 0 g is a silent drop.
  for (const it of result.items) {
    if (it.fdcId !== null && it.gramsTotal <= 0) {
      violations.push({
        code: "matched-but-zero-grams",
        detail: `fdcId ${it.fdcId} resolved to ${it.gramsTotal} g`,
      });
    }
  }

  return violations;
}
