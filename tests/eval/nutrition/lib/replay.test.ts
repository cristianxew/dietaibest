import { describe, it, expect } from "vitest";
import { type FdcFood, type FdcSearchFood } from "@/lib/fdc";
import {
  normalizeKey,
  searchFromStore,
  foodsFromStore,
  canonicalMapFromStore,
  estimatesMapFromStore,
  stage2FromStore,
  EMPTY_STAGE2,
  type FdcFixtureStore,
  type LlmFixtureStore,
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

const llmStore: LlmFixtureStore = {
  canonical: {
    "mięso z piersi kurczaka": "chicken breast",
    "posiłek 1": null,
  },
  estimates: {
    "miso paste": { kcal: 199, protein: 12, fat: 6, carbs: 26, fiber: 5 },
  },
  stage2: {
    "pl-d1-losos-miso": {
      perIngredient: [
        { name: "salmon", cookedState: "cooked", retentionFactor: 0.9, confidence: 0.9, flagged: false },
      ],
      dietLabels: ["high-protein"],
      healthLabels: [],
    },
  },
};

describe("canonicalMapFromStore", () => {
  it("maps each requested raw name to its recorded canonical (key-normalized)", () => {
    const m = canonicalMapFromStore(llmStore, ["Mięso z piersi kurczaka", "Posiłek 1"]);
    expect(m.get("Mięso z piersi kurczaka")).toBe("chicken breast");
    expect(m.get("Posiłek 1")).toBeNull(); // recorded null = not a food
  });

  it("maps an unrecorded name to null (pipeline keeps the raw name)", () => {
    const m = canonicalMapFromStore(llmStore, ["unrecorded"]);
    expect(m.get("unrecorded")).toBeNull();
  });
});

describe("estimatesMapFromStore", () => {
  it("returns the recorded estimate for a known canonical name", () => {
    const m = estimatesMapFromStore(llmStore, ["miso paste"]);
    expect(m.get("miso paste")).toEqual({ kcal: 199, protein: 12, fat: 6, carbs: 26, fiber: 5 });
  });

  it("returns null for a name with no recorded estimate", () => {
    const m = estimatesMapFromStore(llmStore, ["chicken breast"]);
    expect(m.get("chicken breast")).toBeNull();
  });
});

describe("stage2FromStore", () => {
  it("returns the recorded Stage-2 analysis for a known recipe id", () => {
    expect(stage2FromStore(llmStore, "pl-d1-losos-miso").dietLabels).toEqual(["high-protein"]);
  });

  it("returns the empty analysis for a recipe with no recorded Stage 2", () => {
    expect(stage2FromStore(llmStore, "unknown-recipe")).toEqual(EMPTY_STAGE2);
  });
});
