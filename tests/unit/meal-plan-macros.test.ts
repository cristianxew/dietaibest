import { describe, it, expect } from "vitest";
import {
  calculateMealMacros,
  sumMacros,
  compareMacro,
  getProgressPercentage,
  getMacroBarLayout,
} from "@/lib/meal-plan-macros";

describe("calculateMealMacros", () => {
  it("returns per-serving values when mealServings is 1", () => {
    const result = calculateMealMacros(500, 30, 50, 20, 4, 1);
    expect(result).toEqual({
      calories: 500,
      protein: 30,
      carbs: 50,
      fat: 20,
    });
  });

  it("multiplies by mealServings", () => {
    const result = calculateMealMacros(500, 30, 50, 20, 4, 2);
    expect(result).toEqual({
      calories: 1000,
      protein: 60,
      carbs: 100,
      fat: 40,
    });
  });

  it("handles fractional servings with rounding to 1 decimal", () => {
    const result = calculateMealMacros(333, 25.3, 40.7, 15.1, 1, 1.5);
    expect(result.calories).toBe(499.5);
    expect(result.protein).toBe(38);
    expect(result.carbs).toBe(61.1);
    expect(result.fat).toBe(22.7);
  });
});

describe("sumMacros", () => {
  it("sums macros from multiple meals", () => {
    const meals = [
      { calories: 500, protein: 30, carbs: 50, fat: 20 },
      { calories: 300, protein: 20, carbs: 35, fat: 10 },
    ];
    const result = sumMacros(meals);
    expect(result).toEqual({
      calories: 800,
      protein: 50,
      carbs: 85,
      fat: 30,
    });
  });

  it("returns zeros for empty array", () => {
    const result = sumMacros([]);
    expect(result).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe("compareMacro", () => {
  it("returns 'under' when below 90% of target", () => {
    const result = compareMacro(80, 100);
    expect(result.status).toBe("under");
    expect(result.percentage).toBe(80);
  });

  it("returns 'on-track' when between 90-110% of target", () => {
    const result = compareMacro(95, 100);
    expect(result.status).toBe("on-track");
    expect(result.percentage).toBe(95);
  });

  it("returns 'over' when above 110% of target", () => {
    const result = compareMacro(120, 100);
    expect(result.status).toBe("over");
    expect(result.percentage).toBe(120);
  });

  it("returns 'on-track' with undefined percentage when no target", () => {
    const result = compareMacro(100, undefined);
    expect(result.status).toBe("on-track");
    expect(result.percentage).toBeUndefined();
  });
});

describe("getProgressPercentage", () => {
  it("calculates correct percentage", () => {
    expect(getProgressPercentage(50, 100)).toBe(50);
  });

  it("caps at 100%", () => {
    expect(getProgressPercentage(150, 100)).toBe(100);
  });

  it("returns 0 when target is undefined", () => {
    expect(getProgressPercentage(50, undefined)).toBe(0);
  });

  it("returns 0 when target is zero", () => {
    expect(getProgressPercentage(50, 0)).toBe(0);
  });
});

describe("getMacroBarLayout", () => {
  // 30 g P / 50 g C / 20 g F → 120 / 200 / 180 kcal of 500 kcal of macro energy
  const day = { calories: 500, protein: 30, carbs: 50, fat: 20 };

  it("fills calories / target of the track when under target", () => {
    const layout = getMacroBarLayout({ ...day, calories: 218 }, 2650);
    expect(layout.fill).toBeCloseTo((218 / 2650) * 100, 6);
    expect(layout.over).toBe(false);
    expect(layout.targetMarker).toBeNull();
  });

  it("splits the fill by macro energy share (4P / 4C / 9F)", () => {
    const { shares } = getMacroBarLayout(day, 2000);
    expect(shares.protein).toBeCloseTo(24, 6);
    expect(shares.carbs).toBeCloseTo(40, 6);
    expect(shares.fat).toBeCloseTo(36, 6);
    expect(shares.protein + shares.carbs + shares.fat).toBeCloseTo(100, 6);
  });

  it("fills exactly at target without flagging it as over", () => {
    const layout = getMacroBarLayout({ ...day, calories: 2000 }, 2000);
    expect(layout.fill).toBe(100);
    expect(layout.over).toBe(false);
    expect(layout.targetMarker).toBeNull();
  });

  it("caps the fill at 100% and marks the target when over", () => {
    const layout = getMacroBarLayout({ ...day, calories: 2500 }, 2000);
    expect(layout.fill).toBe(100);
    expect(layout.over).toBe(true);
    expect(layout.targetMarker).toBeCloseTo(80, 6);
  });

  it("is a full composition bar without a target", () => {
    for (const target of [undefined, null, 0]) {
      const layout = getMacroBarLayout({ ...day, calories: 218 }, target);
      expect(layout.fill).toBe(100);
      expect(layout.over).toBe(false);
      expect(layout.targetMarker).toBeNull();
      expect(layout.shares.protein).toBeCloseTo(24, 6);
    }
  });

  it("is empty for an empty day", () => {
    const empty = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    expect(getMacroBarLayout(empty, 2000)).toEqual({
      fill: 0,
      shares: { protein: 0, carbs: 0, fat: 0 },
      over: false,
      targetMarker: null,
    });
    expect(getMacroBarLayout(empty).fill).toBe(0);
  });

  it("still fills by calories when the macros are missing", () => {
    const layout = getMacroBarLayout({ calories: 500, protein: 0, carbs: 0, fat: 0 }, 2000);
    expect(layout.fill).toBe(25);
    expect(layout.shares).toEqual({ protein: 0, carbs: 0, fat: 0 });
  });
});
