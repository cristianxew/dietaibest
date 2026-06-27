import { describe, it, expect } from "vitest";
import {
  formatIngredientsForNutrition,
  ingredientsChanged,
} from "@/lib/ingredients";

describe("formatIngredientsForNutrition", () => {
  it("returns an empty array for null or undefined", () => {
    expect(formatIngredientsForNutrition(null)).toEqual([]);
    expect(formatIngredientsForNutrition(undefined)).toEqual([]);
  });

  it("returns an empty array for primitive non-string inputs", () => {
    expect(formatIngredientsForNutrition(42)).toEqual([]);
    expect(formatIngredientsForNutrition(true)).toEqual([]);
  });

  it("passes through plain string lines unchanged (trimmed)", () => {
    expect(
      formatIngredientsForNutrition([
        "2 cups flour",
        "  1 tsp salt  ",
        "3 eggs",
      ])
    ).toEqual(["2 cups flour", "1 tsp salt", "3 eggs"]);
  });

  it("formats structured { name, amount, unit } as 'amount unit name'", () => {
    expect(
      formatIngredientsForNutrition([
        { name: "flour", amount: "2", unit: "cups" },
        { name: "salt", amount: 1, unit: "tsp" },
      ])
    ).toEqual(["2 cups flour", "1 tsp salt"]);
  });

  it("handles structured items with missing amount or unit", () => {
    expect(
      formatIngredientsForNutrition([
        { name: "olive oil" },
        { name: "garlic", amount: 3 },
        { name: "pepper", unit: "pinch" },
      ])
    ).toEqual(["olive oil", "3 garlic", "pinch pepper"]);
  });

  it("skips structured items without a name", () => {
    expect(
      formatIngredientsForNutrition([
        { amount: 1, unit: "cup" },
        { name: "", amount: 2, unit: "tbsp" },
        { name: "sugar", amount: "1/2", unit: "cup" },
      ])
    ).toEqual(["1/2 cup sugar"]);
  });

  it("skips empty strings and non-objects in the array", () => {
    expect(
      formatIngredientsForNutrition([
        "1 onion",
        "",
        "   ",
        null,
        42,
        { name: "carrot", amount: 2, unit: "piece" },
      ])
    ).toEqual(["1 onion", "2 piece carrot"]);
  });

  it("supports a single non-array value by wrapping into an array", () => {
    expect(formatIngredientsForNutrition("1 cup flour")).toEqual([
      "1 cup flour",
    ]);
    expect(
      formatIngredientsForNutrition({ name: "milk", amount: 1, unit: "cup" })
    ).toEqual(["1 cup milk"]);
  });
});

describe("ingredientsChanged", () => {
  it("returns true when an ingredient amount changes", () => {
    const before = [{ name: "flour", amount: 2, unit: "cups" }];
    const after = [{ name: "flour", amount: 3, unit: "cups" }];
    expect(ingredientsChanged(before, after)).toBe(true);
  });

  it("returns false when the ingredients are identical", () => {
    const list = [
      { name: "flour", amount: 2, unit: "cups" },
      { name: "salt", amount: 1, unit: "tsp" },
    ];
    expect(ingredientsChanged(list, structuredClone(list))).toBe(false);
  });

  it("is order-independent (reordering is not a change)", () => {
    const before = [
      { name: "flour", amount: 2, unit: "cups" },
      { name: "salt", amount: 1, unit: "tsp" },
    ];
    const after = [
      { name: "salt", amount: 1, unit: "tsp" },
      { name: "flour", amount: 2, unit: "cups" },
    ];
    expect(ingredientsChanged(before, after)).toBe(false);
  });

  it("ignores cosmetic case/whitespace edits, preserving manual macros", () => {
    const before = [{ name: "Flour", amount: 2, unit: "Cups" }];
    const after = [{ name: "flour", amount: 2, unit: "cups" }];
    expect(ingredientsChanged(before, after)).toBe(false);
  });

  it("returns true when an ingredient is added or removed", () => {
    const before = [{ name: "flour", amount: 2, unit: "cups" }];
    const after = [
      { name: "flour", amount: 2, unit: "cups" },
      { name: "sugar", amount: 1, unit: "cup" },
    ];
    expect(ingredientsChanged(before, after)).toBe(true);
    expect(ingredientsChanged(after, before)).toBe(true);
  });

  it("treats null/undefined/empty as no ingredients", () => {
    expect(ingredientsChanged(null, undefined)).toBe(false);
    expect(ingredientsChanged(null, [])).toBe(false);
    expect(
      ingredientsChanged(null, [{ name: "flour", amount: 2, unit: "cups" }])
    ).toBe(true);
  });

  it("compares the analyzer lines, so amount '2' equals number 2", () => {
    const before = [{ name: "flour", amount: "2", unit: "cups" }];
    const after = [{ name: "flour", amount: 2, unit: "cups" }];
    expect(ingredientsChanged(before, after)).toBe(false);
  });
});
