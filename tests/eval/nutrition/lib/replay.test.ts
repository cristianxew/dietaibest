import { describe, it, expect } from "vitest";
import { type FdcFood, type FdcSearchFood } from "@/lib/fdc";
import {
  normalizeKey,
  searchFromStore,
  foodsFromStore,
  type FdcFixtureStore,
} from "./replay";

const eggFood: FdcFood = {
  fdcId: 171287,
  description: "Egg, whole, raw, fresh",
  dataType: "SR Legacy",
  foodNutrients: [{ nutrientNumber: "208", amount: 143, unitName: "KCAL" }],
};
const spinachFood: FdcFood = {
  fdcId: 168462,
  description: "Spinach, raw",
  dataType: "SR Legacy",
  foodNutrients: [{ nutrientNumber: "208", amount: 23, unitName: "KCAL" }],
};

const eggHit: FdcSearchFood = {
  fdcId: 171287,
  description: "Egg, whole, raw, fresh",
  dataType: "SR Legacy",
};

const store: FdcFixtureStore = {
  search: { egg: [eggHit] },
  foods: { 171287: eggFood, 168462: spinachFood },
};

describe("normalizeKey", () => {
  it("lowercases, trims, and collapses internal whitespace", () => {
    expect(normalizeKey("  Olive   Oil ")).toBe("olive oil");
  });
});

describe("searchFromStore", () => {
  it("returns the recorded hits for a known query (key-normalized)", () => {
    expect(searchFromStore(store, "EGG")).toEqual([eggHit]);
  });

  it("returns an empty array for an unrecorded query", () => {
    expect(searchFromStore(store, "unicorn")).toEqual([]);
  });
});

describe("foodsFromStore", () => {
  it("returns the requested foods, skipping ids not in the store", () => {
    const foods = foodsFromStore(store, [171287, 999999, 168462]);
    expect(foods.map((f) => f.fdcId)).toEqual([171287, 168462]);
  });
});
