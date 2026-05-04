import { describe, it, expect } from "vitest";
import { formatIngredientsForNutrition } from "@/lib/ingredients";

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
