import { describe, it, expect } from "vitest";
import type { FdcFood } from "@/lib/fdc";
import {
  extractNutrientVector,
  scaleVector,
  addVectors,
  type NutrientVector,
} from "@/lib/nutrients/extract";

/** Full-format payload: nutrient numbers nested under `nutrient.number` */
const fullFormatBanana: FdcFood = {
  fdcId: 173944,
  description: "Bananas, raw",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrient: { number: "208", name: "Energy", unitName: "kcal" }, amount: 89 },
    { nutrient: { number: "203", name: "Protein", unitName: "g" }, amount: 1.09 },
    { nutrient: { number: "306", name: "Potassium, K", unitName: "mg" }, amount: 358 },
    { nutrient: { number: "401", name: "Vitamin C", unitName: "mg" }, amount: 8.7 },
  ],
};

/** Abridged-format payload: flat `nutrientNumber` field */
const abridgedApple: FdcFood = {
  fdcId: 171688,
  description: "Apples, raw, with skin",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrientNumber: "208", nutrientName: "Energy", amount: 52, unitName: "kcal" },
    { nutrientNumber: "291", nutrientName: "Fiber", amount: 2.4, unitName: "g" },
    { nutrientNumber: "306", nutrientName: "Potassium, K", amount: 107, unitName: "mg" },
  ],
};

describe("extractNutrientVector", () => {
  it("extracts nutrients from full-format payloads (nutrient.number)", () => {
    const v = extractNutrientVector(fullFormatBanana);
    expect(v.kcal).toBe(89);
    expect(v.protein).toBe(1.09);
    expect(v.potassium).toBe(358);
    expect(v.vitaminC).toBe(8.7);
  });

  it("extracts nutrients from abridged payloads (nutrientNumber)", () => {
    const v = extractNutrientVector(abridgedApple);
    expect(v.kcal).toBe(52);
    expect(v.fiber).toBe(2.4);
    expect(v.potassium).toBe(107);
  });

  it("leaves missing nutrients ABSENT — never zero", () => {
    const v = extractNutrientVector(abridgedApple);
    expect("vitaminC" in v).toBe(false);
    expect("sodium" in v).toBe(false);
    expect(v.vitaminC).toBeUndefined();
  });

  it("ignores nutrient numbers not in the registry", () => {
    const food: FdcFood = {
      fdcId: 1,
      description: "x",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "999", nutrientName: "Mystery", amount: 42 },
        { nutrientNumber: "208", amount: 100 },
      ],
    };
    const v = extractNutrientVector(food);
    expect(Object.keys(v)).toEqual(["kcal"]);
  });

  it("skips entries with non-numeric amounts and handles empty foodNutrients", () => {
    const food: FdcFood = {
      fdcId: 2,
      description: "y",
      dataType: "Foundation",
      foodNutrients: [
        // @ts-expect-error simulating malformed API data
        { nutrientNumber: "208", amount: "not-a-number" },
      ],
    };
    expect(extractNutrientVector(food)).toEqual({});
    expect(
      extractNutrientVector({ fdcId: 3, description: "z", dataType: "Foundation" })
    ).toEqual({});
  });
});

describe("scaleVector", () => {
  it("scales every present key and invents none", () => {
    const v: NutrientVector = { kcal: 100, potassium: 200 };
    const scaled = scaleVector(v, 0.5);
    expect(scaled).toEqual({ kcal: 50, potassium: 100 });
    expect("sodium" in scaled).toBe(false);
  });

  it("scaling by zero keeps keys with zero values (known-zero ≠ unknown)", () => {
    expect(scaleVector({ kcal: 89 }, 0)).toEqual({ kcal: 0 });
  });
});

describe("addVectors", () => {
  it("sums keys present in both vectors", () => {
    expect(addVectors({ kcal: 100, fiber: 2 }, { kcal: 50, fiber: 1 })).toEqual(
      { kcal: 150, fiber: 3 }
    );
  });

  it("keeps keys present in only one vector (union semantics)", () => {
    const sum = addVectors({ kcal: 100 }, { potassium: 358 });
    expect(sum).toEqual({ kcal: 100, potassium: 358 });
  });

  it("returns empty for two empty vectors", () => {
    expect(addVectors({}, {})).toEqual({});
  });
});
