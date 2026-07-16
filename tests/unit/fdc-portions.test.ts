import { describe, expect, it } from "vitest";
import {
  resolveGramWeightFromPortions,
  type FdcFood,
  type FdcFoodPortion,
} from "@/lib/fdc";

/** Build a minimal FdcFood carrying only the given portions. */
function foodWithPortions(portions: FdcFoodPortion[]): FdcFood {
  return {
    fdcId: 1,
    description: "test food",
    dataType: "Foundation",
    foodPortions: portions,
  };
}

describe("resolveGramWeightFromPortions — per-unit gram weight", () => {
  it("divides gramWeight by the portion amount (2 tbsp = 30g → 15g per tbsp)", () => {
    const food = foodWithPortions([
      {
        amount: 2,
        gramWeight: 30,
        measureUnit: { name: "tablespoon", abbreviation: "tbsp" },
        portionDescription: "2 tbsp",
      },
    ]);
    expect(resolveGramWeightFromPortions(food, "tbsp")).toBe(15);
  });

  it("matches via the structured measureUnit when the description lacks the token", () => {
    const food = foodWithPortions([
      {
        amount: 1,
        gramWeight: 122,
        measureUnit: { name: "cup", abbreviation: "cup" },
        portionDescription: "1 serving",
      },
    ]);
    expect(resolveGramWeightFromPortions(food, "cup")).toBe(122);
  });

  it("normalizes a plural request unit against a singular portion (cloves → clove)", () => {
    const food = foodWithPortions([
      { amount: 1, gramWeight: 3, portionDescription: "1 clove" },
    ]);
    expect(resolveGramWeightFromPortions(food, "cloves")).toBe(3);
  });

  it("matches a synonym/full-word unit in the description (tablespoon → tbsp)", () => {
    const food = foodWithPortions([
      { amount: 1, gramWeight: 14, portionDescription: "1 tablespoon" },
    ]);
    expect(resolveGramWeightFromPortions(food, "tbsp")).toBe(14);
  });

  it("does NOT substring-match a unit inside an unrelated word (g vs 'large egg')", () => {
    const food = foodWithPortions([
      { amount: 1, gramWeight: 50, portionDescription: "1 large egg" },
    ]);
    expect(resolveGramWeightFromPortions(food, "g")).toBeNull();
  });

  it("returns null when no portion names the requested unit", () => {
    const food = foodWithPortions([
      { amount: 1, gramWeight: 100, portionDescription: "1 cup" },
    ]);
    expect(resolveGramWeightFromPortions(food, "tbsp")).toBeNull();
  });

  it("prefers the structured measureUnit over a misleading text token", () => {
    // Description mentions "cup" but the real measure unit is tbsp at 15g.
    const food = foodWithPortions([
      {
        amount: 1,
        gramWeight: 15,
        measureUnit: { name: "tablespoon", abbreviation: "tbsp" },
        portionDescription: "1 tbsp (about 1/16 cup)",
      },
    ]);
    expect(resolveGramWeightFromPortions(food, "tbsp")).toBe(15);
  });
});
