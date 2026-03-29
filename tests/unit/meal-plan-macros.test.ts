import { describe, it, expect } from "vitest";
import {
  calculateMealMacros,
  sumMacros,
  compareMacro,
  getProgressPercentage,
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
