import { describe, it, expect } from "vitest";

import {
  calorieShares,
  getMacroBreakdown,
  macroKcal,
  progressPercent,
  resolveMacroTargets,
} from "@/lib/macro-breakdown";

describe("macroKcal", () => {
  it("converts grams to kcal with 4 / 4 / 9 kcal per gram", () => {
    expect(macroKcal({ protein: 99, carbs: 50, fat: 21 })).toEqual({
      protein: 396,
      carbs: 200,
      fat: 189,
    });
  });

  it("treats null, negative and non-finite grams as 0", () => {
    expect(
      macroKcal({ protein: null, carbs: -5, fat: Number.NaN })
    ).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});

describe("calorieShares", () => {
  // Regression: the dashboard divided macro kcal (785) by the recipe kcal
  // (577) and showed 69 / 35 / 33 = 137%.
  it("splits macro-derived kcal so the shares add up to exactly 100", () => {
    const shares = calorieShares({ protein: 99, carbs: 50, fat: 21 });

    expect(shares.protein + shares.carbs + shares.fat).toBe(100);
    // 396 / 200 / 189 of 785 kcal = 50.45 / 25.48 / 24.08 %
    expect(shares).toEqual({ protein: 50, carbs: 26, fat: 24 });
  });

  it("gives the leftover point to the largest remainder", () => {
    // 1 / 1 / 1 g -> 4 / 4 / 9 kcal of 17 = 23.53 / 23.53 / 52.94 %
    const shares = calorieShares({ protein: 1, carbs: 1, fat: 1 });
    expect(shares).toEqual({ protein: 24, carbs: 23, fat: 53 });
  });

  it("returns integers that add up to 100 for awkward splits", () => {
    const shares = calorieShares({ protein: 10, carbs: 10, fat: 10 / 2.25 });
    // 40 / 40 / 40 kcal: each 33.33 %
    expect(shares.protein + shares.carbs + shares.fat).toBe(100);
    for (const value of Object.values(shares)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("is all zero when there are no macros", () => {
    expect(calorieShares({ protein: 0, carbs: 0, fat: 0 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("gives a single macro 100%", () => {
    expect(calorieShares({ protein: 0, carbs: 0, fat: 12 })).toEqual({
      protein: 0,
      carbs: 0,
      fat: 100,
    });
  });
});

describe("progressPercent", () => {
  it("rounds current / target to a whole percent", () => {
    expect(progressPercent(577, 2400)).toBe(24);
    expect(progressPercent(99, 150)).toBe(66);
  });

  it("is not capped, so overshoot stays visible", () => {
    expect(progressPercent(3000, 2400)).toBe(125);
  });

  it("is null without a usable target", () => {
    expect(progressPercent(100, null)).toBeNull();
    expect(progressPercent(100, undefined)).toBeNull();
    expect(progressPercent(100, 0)).toBeNull();
    expect(progressPercent(100, -10)).toBeNull();
  });

  it("is 0 when nothing is planned yet", () => {
    expect(progressPercent(0, 2400)).toBe(0);
    expect(progressPercent(null, 2400)).toBe(0);
  });
});

describe("getMacroBreakdown", () => {
  const targets = { calories: 2400, protein: 150, carbs: 250, fat: 80 };

  it("lists protein, carbs and fat in design-system order", () => {
    const breakdown = getMacroBreakdown(
      { calories: 577, protein: 99, carbs: 50, fat: 21 },
      targets
    );

    expect(breakdown.macros.map((m) => m.key)).toEqual(["protein", "carbs", "fat"]);
  });

  it("reports grams, kcal, calorie share and target progress per macro", () => {
    const breakdown = getMacroBreakdown(
      { calories: 577, protein: 99, carbs: 50, fat: 21 },
      targets
    );

    expect(breakdown.macros).toEqual([
      { key: "protein", grams: 99, kcal: 396, share: 50, target: 150, progress: 66 },
      { key: "carbs", grams: 50, kcal: 200, share: 26, target: 250, progress: 20 },
      { key: "fat", grams: 21, kcal: 189, share: 24, target: 80, progress: 26 },
    ]);
    expect(breakdown.macroKcal).toBe(785);
  });

  it("uses the stored calories as the total and measures progress against it", () => {
    const breakdown = getMacroBreakdown(
      { calories: 577, protein: 99, carbs: 50, fat: 21 },
      targets
    );

    expect(breakdown.totalKcal).toBe(577);
    expect(breakdown.calorieProgress).toBe(24);
  });

  it("falls back to macro-derived kcal when calories are 0", () => {
    const breakdown = getMacroBreakdown(
      { calories: 0, protein: 99, carbs: 50, fat: 21 },
      targets
    );

    expect(breakdown.totalKcal).toBe(785);
    expect(breakdown.calorieProgress).toBe(33);
  });

  it("handles an all-zero day", () => {
    const breakdown = getMacroBreakdown(
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
      targets
    );

    expect(breakdown.totalKcal).toBe(0);
    expect(breakdown.macroKcal).toBe(0);
    expect(breakdown.calorieProgress).toBe(0);
    expect(breakdown.macros.map((m) => m.share)).toEqual([0, 0, 0]);
    expect(breakdown.macros.map((m) => m.progress)).toEqual([0, 0, 0]);
  });

  it("reports null progress when targets are missing", () => {
    const breakdown = getMacroBreakdown(
      { calories: 577, protein: 99, carbs: 50, fat: 21 },
      { calories: null, protein: null, carbs: null, fat: null }
    );

    expect(breakdown.calorieProgress).toBeNull();
    expect(breakdown.macros.every((m) => m.progress === null)).toBe(true);
    expect(breakdown.macros.every((m) => m.target === null)).toBe(true);
  });
});

describe("resolveMacroTargets", () => {
  const profile = { dailyCalories: 2200, proteinGrams: 140, carbsGrams: 230, fatGrams: 70 };

  it("prefers the active plan's targets", () => {
    const plan = { targetCalories: 2400, targetProtein: 150, targetCarbs: 250, targetFat: 80 };

    expect(resolveMacroTargets(plan, profile)).toEqual({
      calories: 2400,
      protein: 150,
      carbs: 250,
      fat: 80,
    });
  });

  it("falls back to the profile per macro when the plan has no target", () => {
    const plan = { targetCalories: 2400, targetProtein: null, targetCarbs: 0, targetFat: undefined };

    expect(resolveMacroTargets(plan, profile)).toEqual({
      calories: 2400,
      protein: 140,
      carbs: 230,
      fat: 70,
    });
  });

  it("uses the profile when there is no active plan", () => {
    expect(resolveMacroTargets(null, profile)).toEqual({
      calories: 2200,
      protein: 140,
      carbs: 230,
      fat: 70,
    });
  });

  it("is all null with neither plan nor profile", () => {
    expect(resolveMacroTargets(null, null)).toEqual({
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
    });
  });
});
