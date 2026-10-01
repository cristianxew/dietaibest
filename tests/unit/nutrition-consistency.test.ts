import { describe, it, expect } from "vitest";
import { atwaterCalories, hasCalorieMacroMismatch } from "@/lib/nutrition-consistency";

describe("atwaterCalories", () => {
  it("is 4 kcal/g protein and carbs, 9 kcal/g fat", () => {
    expect(atwaterCalories({ protein: 30, carbs: 50, fat: 20 })).toBe(500);
  });

  it("counts missing macros as 0 g", () => {
    expect(atwaterCalories({ protein: 10, carbs: null })).toBe(40);
  });
});

describe("hasCalorieMacroMismatch", () => {
  it("accepts a recipe whose calories match its macros", () => {
    expect(hasCalorieMacroMismatch({ calories: 500, protein: 30, carbs: 50, fat: 20 })).toBe(false);
    // Fibre and rounding make real recipes drift a little
    expect(hasCalorieMacroMismatch({ calories: 470, protein: 30, carbs: 50, fat: 20 })).toBe(false);
  });

  it("flags legacy granola: 123 kcal stored for 22 g P / 90 g C / 30 g F (≈718 kcal)", () => {
    expect(hasCalorieMacroMismatch({ calories: 123, protein: 22, carbs: 90, fat: 30 })).toBe(true);
  });

  it("flags calories far above the macro estimate too", () => {
    expect(hasCalorieMacroMismatch({ calories: 900, protein: 10, carbs: 20, fat: 5 })).toBe(true);
  });

  it("never flags zero or missing calories", () => {
    expect(hasCalorieMacroMismatch({ calories: 0, protein: 22, carbs: 90, fat: 30 })).toBe(false);
    expect(hasCalorieMacroMismatch({ calories: null, protein: 22, carbs: 90, fat: 30 })).toBe(false);
    expect(hasCalorieMacroMismatch({ protein: 22, carbs: 90, fat: 30 })).toBe(false);
    expect(hasCalorieMacroMismatch({ calories: Number.NaN, protein: 22 })).toBe(false);
  });

  it("does not judge calories when no macro is known", () => {
    expect(hasCalorieMacroMismatch({ calories: 300 })).toBe(false);
    expect(hasCalorieMacroMismatch({ calories: 300, protein: null, carbs: null, fat: null })).toBe(false);
  });

  it("flags calories when the known macros are all zero", () => {
    expect(hasCalorieMacroMismatch({ calories: 300, protein: 0, carbs: 0, fat: 0 })).toBe(true);
  });

  describe("thresholds: > 25% of the larger value AND > 40 kcal", () => {
    it("needs more than 25% of the larger value", () => {
      // 200 vs 260: 60 kcal off, 25% of 260 is 65 → within tolerance
      expect(hasCalorieMacroMismatch({ calories: 200, carbs: 65 })).toBe(false);
      // 300 vs 400: exactly 25% of 400 → not more than 25%
      expect(hasCalorieMacroMismatch({ calories: 300, carbs: 100 })).toBe(false);
      // 200 vs 272: 72 kcal off, 25% of 272 is 68 → mismatch
      expect(hasCalorieMacroMismatch({ calories: 200, carbs: 68 })).toBe(true);
    });

    it("needs more than 40 kcal, so small recipes don't trip the relative check", () => {
      // 100 vs 140: 29% off but exactly 40 kcal → within tolerance
      expect(hasCalorieMacroMismatch({ calories: 100, protein: 35 })).toBe(false);
      // 20 vs 50: 60% off but only 30 kcal → within tolerance
      expect(hasCalorieMacroMismatch({ calories: 20, carbs: 12.5 })).toBe(false);
      // 100 vs 141: 41 kcal and 29% off → mismatch
      expect(hasCalorieMacroMismatch({ calories: 100, protein: 33, fat: 1 })).toBe(true);
    });
  });
});
