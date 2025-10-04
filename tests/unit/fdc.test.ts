/**
 * Unit Tests for FDC (FoodData Central) Utilities
 * Tests extractMacrosFromFood, scalePer100g, and resolveGramWeightFromPortions
 */

import { describe, it, expect } from "vitest";
import {
  extractMacrosFromFood,
  scalePer100g,
  resolveGramWeightFromPortions,
  type Macro,
  type FdcFood,
  FdcFoodNutrient,
} from "@/lib/fdc";

describe("extractMacrosFromFood", () => {
  it("extracts macros from abridged FDC payload", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 12345,
      description: "Chicken breast",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 165 }, // kcal
        { nutrientNumber: "203", amount: 31 }, // protein
        { nutrientNumber: "204", amount: 3.6 }, // fat
        { nutrientNumber: "205", amount: 0 }, // carbs
        { nutrientNumber: "291", amount: 0 }, // fiber
      ],
    };

    const macros = extractMacrosFromFood(mockFood as FdcFood);

    expect(macros.kcal).toBe(165);
    expect(macros.protein).toBe(31);
    expect(macros.fat).toBe(3.6);
    expect(macros.carbs).toBe(0);
    expect(macros.fiber).toBe(0);
  });

  it("extracts macros from full FDC payload with nutrient objects", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 67890,
      description: "Brown rice",
      dataType: "SR Legacy",
      foodNutrients: [
        {
          nutrient: { number: "208", name: "Energy" },
          amount: 123,
        },
        {
          nutrient: { number: "203", name: "Protein" },
          amount: 2.6,
        },
        {
          nutrient: { number: "204", name: "Total lipid (fat)" },
          amount: 0.9,
        },
        {
          nutrient: { number: "205", name: "Carbohydrate, by difference" },
          amount: 25.6,
        },
        {
          nutrient: { number: "291", name: "Fiber, total dietary" },
          amount: 1.6,
        },
      ],
    };

    const macros = extractMacrosFromFood(mockFood as FdcFood);

    expect(macros.kcal).toBe(123);
    expect(macros.protein).toBe(2.6);
    expect(macros.fat).toBe(0.9);
    expect(macros.carbs).toBe(25.6);
    expect(macros.fiber).toBe(1.6);
  });

  it("returns zeros for missing nutrients", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 111,
      description: "Incomplete food",
      dataType: "Branded",
      foodNutrients: [
        { nutrientNumber: "208", amount: 100 }, // only calories
      ],
    };

    const macros = extractMacrosFromFood(mockFood as FdcFood);

    expect(macros.kcal).toBe(100);
    expect(macros.protein).toBe(0);
    expect(macros.fat).toBe(0);
    expect(macros.carbs).toBe(0);
    expect(macros.fiber).toBe(0);
  });

  it("handles empty foodNutrients array", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 222,
      description: "Empty food",
      dataType: "Foundation",
      foodNutrients: [],
    };

    const macros = extractMacrosFromFood(mockFood as FdcFood);

    expect(macros.kcal).toBe(0);
    expect(macros.protein).toBe(0);
    expect(macros.fat).toBe(0);
    expect(macros.carbs).toBe(0);
    expect(macros.fiber).toBe(0);
  });

  it("handles missing foodNutrients property", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 333,
      description: "No nutrients",
      dataType: "Foundation",
    };

    const macros = extractMacrosFromFood(mockFood as FdcFood);

    expect(macros.kcal).toBe(0);
    expect(macros.protein).toBe(0);
    expect(macros.fat).toBe(0);
    expect(macros.carbs).toBe(0);
    expect(macros.fiber).toBe(0);
  });

  it("ignores nutrients with invalid or missing amounts", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 444,
      description: "Invalid nutrients",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 100 },
        { nutrientNumber: "203", amount: undefined }, // missing amount
        { nutrientNumber: "204", amount: null },
        { nutrientNumber: "205", amount: "invalid" },
      ] as FdcFoodNutrient[],
    };

    const macros = extractMacrosFromFood(mockFood as FdcFood);

    expect(macros.kcal).toBe(100);
    expect(macros.protein).toBe(0);
    expect(macros.fat).toBe(0);
    expect(macros.carbs).toBe(0);
  });
});

describe("scalePer100g", () => {
  it("scales macros for 100g (should be unchanged)", () => {
    const macros: Macro = {
      kcal: 165,
      protein: 31,
      fat: 3.6,
      carbs: 0,
      fiber: 0,
    };

    const scaled = scalePer100g(macros, 100);

    expect(scaled.kcal).toBe(165);
    expect(scaled.protein).toBe(31);
    expect(scaled.fat).toBe(3.6);
    expect(scaled.carbs).toBe(0);
    expect(scaled.fiber).toBe(0);
  });

  it("scales macros for 50g (half)", () => {
    const macros: Macro = {
      kcal: 200,
      protein: 20,
      fat: 10,
      carbs: 30,
      fiber: 5,
    };

    const scaled = scalePer100g(macros, 50);

    expect(scaled.kcal).toBe(100);
    expect(scaled.protein).toBe(10);
    expect(scaled.fat).toBe(5);
    expect(scaled.carbs).toBe(15);
    expect(scaled.fiber).toBe(2.5);
  });

  it("scales macros for 200g (double)", () => {
    const macros: Macro = {
      kcal: 100,
      protein: 15,
      fat: 5,
      carbs: 20,
      fiber: 3,
    };

    const scaled = scalePer100g(macros, 200);

    expect(scaled.kcal).toBe(200);
    expect(scaled.protein).toBe(30);
    expect(scaled.fat).toBe(10);
    expect(scaled.carbs).toBe(40);
    expect(scaled.fiber).toBe(6);
  });

  it("scales macros for 25g (quarter)", () => {
    const macros: Macro = {
      kcal: 400,
      protein: 40,
      fat: 20,
      carbs: 60,
      fiber: 8,
    };

    const scaled = scalePer100g(macros, 25);

    expect(scaled.kcal).toBe(100);
    expect(scaled.protein).toBe(10);
    expect(scaled.fat).toBe(5);
    expect(scaled.carbs).toBe(15);
    expect(scaled.fiber).toBe(2);
  });

  it("handles zero grams", () => {
    const macros: Macro = {
      kcal: 100,
      protein: 10,
      fat: 5,
      carbs: 15,
      fiber: 2,
    };

    const scaled = scalePer100g(macros, 0);

    expect(scaled.kcal).toBe(0);
    expect(scaled.protein).toBe(0);
    expect(scaled.fat).toBe(0);
    expect(scaled.carbs).toBe(0);
    expect(scaled.fiber).toBe(0);
  });

  it("handles decimal gram amounts", () => {
    const macros: Macro = {
      kcal: 100,
      protein: 20,
      fat: 10,
      carbs: 15,
      fiber: 5,
    };

    const scaled = scalePer100g(macros, 33.33);

    expect(scaled.kcal).toBeCloseTo(33.33, 1);
    expect(scaled.protein).toBeCloseTo(6.666, 1);
    expect(scaled.fat).toBeCloseTo(3.333, 1);
    expect(scaled.carbs).toBeCloseTo(4.9995, 1);
    expect(scaled.fiber).toBeCloseTo(1.6665, 1);
  });

  it("handles very large amounts", () => {
    const macros: Macro = {
      kcal: 100,
      protein: 10,
      fat: 5,
      carbs: 20,
      fiber: 3,
    };

    const scaled = scalePer100g(macros, 1000);

    expect(scaled.kcal).toBe(1000);
    expect(scaled.protein).toBe(100);
    expect(scaled.fat).toBe(50);
    expect(scaled.carbs).toBe(200);
    expect(scaled.fiber).toBe(30);
  });

  it("preserves zero values in macros", () => {
    const macros: Macro = {
      kcal: 50,
      protein: 0,
      fat: 0,
      carbs: 12,
      fiber: 0,
    };

    const scaled = scalePer100g(macros, 150);

    expect(scaled.kcal).toBe(75);
    expect(scaled.protein).toBe(0);
    expect(scaled.fat).toBe(0);
    expect(scaled.carbs).toBe(18);
    expect(scaled.fiber).toBe(0);
  });
});

describe("resolveGramWeightFromPortions", () => {
  it("finds matching cup portion", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 123,
      description: "Rice",
      dataType: "Foundation",
      foodPortions: [
        { portionDescription: "cup", gramWeight: 158 },
        { portionDescription: "tablespoon", gramWeight: 12 },
      ],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "cup"
    );

    expect(gramWeight).toBe(158);
  });

  it("finds matching tablespoon portion", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 456,
      description: "Olive oil",
      dataType: "Foundation",
      foodPortions: [
        { portionDescription: "tbsp", gramWeight: 13.5 },
        { portionDescription: "tsp", gramWeight: 4.5 },
      ],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "tbsp"
    );

    expect(gramWeight).toBe(13.5);
  });

  it("returns null when no matching portion found", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 789,
      description: "Chicken",
      dataType: "Foundation",
      foodPortions: [
        { portionDescription: "oz", gramWeight: 28 },
        { portionDescription: "lb", gramWeight: 454 },
      ],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "cup"
    );

    expect(gramWeight).toBeNull();
  });

  it("handles empty foodPortions array", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 111,
      description: "Simple food",
      dataType: "Branded",
      foodPortions: [],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "cup"
    );

    expect(gramWeight).toBeNull();
  });

  it("handles missing foodPortions property", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 222,
      description: "No portions",
      dataType: "Foundation",
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "cup"
    );

    expect(gramWeight).toBeNull();
  });

  it("matches case-insensitively", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 333,
      description: "Mixed case",
      dataType: "Foundation",
      foodPortions: [{ portionDescription: "Cup", gramWeight: 200 }],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "CUP"
    );

    expect(gramWeight).toBe(200);
  });

  it("matches portion with modifier", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 444,
      description: "Food with modifier",
      dataType: "Foundation",
      foodPortions: [
        {
          portionDescription: "cup",
          modifier: "chopped",
          gramWeight: 160,
        },
        {
          portionDescription: "cup",
          modifier: "sliced",
          gramWeight: 120,
        },
      ],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "cup"
    );

    // Should match first cup portion found
    expect(gramWeight).toBe(160);
  });

  it("finds teaspoon portion", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 555,
      description: "Salt",
      dataType: "SR Legacy",
      foodPortions: [
        { portionDescription: "tsp", gramWeight: 6 },
        { portionDescription: "tbsp", gramWeight: 18 },
      ],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "tsp"
    );

    expect(gramWeight).toBe(6);
  });

  it("handles portions with null or undefined values", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 666,
      description: "Incomplete portions",
      dataType: "Foundation",
      foodPortions: [
        { portionDescription: null as unknown as string, gramWeight: 100 },
        { portionDescription: "cup", gramWeight: null as unknown as number },
        { portionDescription: "tbsp", gramWeight: 15 },
      ],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "cup"
    );

    expect(gramWeight).toBeNull(); // gramWeight is null for cup
  });

  it("matches partial string in portion description", () => {
    const mockFood: Partial<FdcFood> = {
      fdcId: 777,
      description: "Partial match",
      dataType: "Foundation",
      foodPortions: [{ portionDescription: "1 cup, slices", gramWeight: 140 }],
    };

    const gramWeight = resolveGramWeightFromPortions(
      mockFood as FdcFood,
      "cup"
    );

    expect(gramWeight).toBe(140);
  });
});
