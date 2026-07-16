import { describe, it, expect } from "vitest";
import { type Profile } from "@/lib/fdc";
import {
  compareMacros,
  macrosPass,
  checkInvariants,
  TOLERANCES,
  type MacroExpectation,
} from "./assert-macros";

/** Build a full 22-field Profile, defaulting every field to 0. */
function makeProfile(partial: Partial<Profile>): Profile {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    cholesterol: 0,
    saturatedFat: 0,
    transFat: 0,
    vitaminA: 0,
    vitaminC: 0,
    vitaminD: 0,
    vitaminE: 0,
    vitaminK: 0,
    vitaminB12: 0,
    folate: 0,
    iron: 0,
    calcium: 0,
    magnesium: 0,
    potassium: 0,
    zinc: 0,
    ...partial,
  };
}

const expected: MacroExpectation = {
  calories: 400,
  protein: 30,
  fat: 15,
  carbs: 35,
  fiber: 5,
};

describe("compareMacros", () => {
  it("passes when every macro is within the tier tolerance", () => {
    // anchor calories tol = 0.10 → 400±40; protein 0.15 → 30±4.5, etc.
    const actual = makeProfile({
      calories: 420,
      protein: 33,
      fat: 16,
      carbs: 32,
      fiber: 6,
    });
    const cmp = compareMacros(actual, expected, "anchor");
    expect(macrosPass(cmp)).toBe(true);
  });

  it("fails the specific macro that exceeds tolerance", () => {
    // calories off by 25% — anchor calories tol is 10%
    const actual = makeProfile({
      calories: 500,
      protein: 30,
      fat: 15,
      carbs: 35,
      fiber: 5,
    });
    const cmp = compareMacros(actual, expected, "anchor");
    expect(macrosPass(cmp)).toBe(false);
    const cals = cmp.find((c) => c.field === "calories")!;
    expect(cals.ok).toBe(false);
    expect(cmp.find((c) => c.field === "protein")!.ok).toBe(true);
  });

  it("is looser for the real tier than the anchor tier", () => {
    // calories off by 20%: fails anchor (10%) but passes real (25%)
    const actual = makeProfile({ ...expected, calories: 480 });
    expect(macrosPass(compareMacros(actual, expected, "anchor"))).toBe(false);
    expect(macrosPass(compareMacros(actual, expected, "real"))).toBe(true);
  });

  it("omits a macro the expectation does not provide (e.g. label without fiber)", () => {
    const noFiber: MacroExpectation = {
      calories: 400,
      protein: 30,
      fat: 15,
      carbs: 35,
    };
    const actual = makeProfile({ ...expected, fiber: 99 });
    const cmp = compareMacros(actual, noFiber, "anchor");
    expect(cmp.map((c) => c.field)).not.toContain("fiber");
    expect(macrosPass(cmp)).toBe(true);
  });

  it("treats expected 0 as pass only when actual is also 0", () => {
    const zeroFiber: MacroExpectation = { ...expected, fiber: 0 };
    const ok = makeProfile({ ...expected, fiber: 0 });
    const bad = makeProfile({ ...expected, fiber: 3 });
    expect(
      compareMacros(ok, zeroFiber, "anchor").find((c) => c.field === "fiber")!
        .ok
    ).toBe(true);
    expect(
      compareMacros(bad, zeroFiber, "anchor").find((c) => c.field === "fiber")!
        .ok
    ).toBe(false);
  });
});

describe("checkInvariants", () => {
  const cleanResult = {
    success: true,
    total: makeProfile({ calories: 800, protein: 60, fat: 30, carbs: 70 }),
    perServing: makeProfile({ calories: 400, protein: 30, fat: 15, carbs: 35 }),
    items: [
      { fdcId: 168462, gramsTotal: 200 },
      { fdcId: 171077, gramsTotal: 150 },
    ],
  };

  it("returns no violations for a consistent, plausible result", () => {
    expect(checkInvariants(cleanResult, 2)).toEqual([]);
  });

  it("flags perServing × servings not matching total", () => {
    const broken = {
      ...cleanResult,
      perServing: makeProfile({ calories: 999 }),
    };
    const v = checkInvariants(broken, 2);
    expect(v.some((x) => x.code === "inconsistent-division")).toBe(true);
  });

  it("flags an implausible kcal density above ~9.5 per gram", () => {
    // 800 kcal over 10 g total = 80 kcal/g
    const dense = {
      ...cleanResult,
      items: [{ fdcId: 1, gramsTotal: 10 }],
      total: makeProfile({ calories: 800 }),
      perServing: makeProfile({ calories: 400 }),
    };
    const v = checkInvariants(dense, 2);
    expect(v.some((x) => x.code === "implausible-kcal-density")).toBe(true);
  });

  it("flags an ingredient matched to a food but resolved to 0 g", () => {
    const silentZero = {
      ...cleanResult,
      items: [
        { fdcId: 168462, gramsTotal: 200 },
        { fdcId: 555, gramsTotal: 0 },
      ],
    };
    const v = checkInvariants(silentZero, 2);
    expect(v.some((x) => x.code === "matched-but-zero-grams")).toBe(true);
  });

  it("flags a negative or NaN nutrient value", () => {
    const nan = { ...cleanResult, total: makeProfile({ calories: NaN }) };
    const v = checkInvariants(nan, 2);
    expect(v.some((x) => x.code === "negative-or-nan")).toBe(true);
  });

  it("flags a failed analysis", () => {
    const failed = { ...cleanResult, success: false };
    const v = checkInvariants(failed, 2);
    expect(v.some((x) => x.code === "analysis-failed")).toBe(true);
  });
});

describe("TOLERANCES", () => {
  it("defines anchor tighter than real for calories", () => {
    expect(TOLERANCES.anchor.calories).toBeLessThan(TOLERANCES.real.calories);
  });
});
