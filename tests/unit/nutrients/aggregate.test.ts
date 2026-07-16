import { describe, it, expect } from "vitest";
import {
  aggregateRecipeNutrients,
  type IngredientContribution,
} from "@/lib/nutrients/aggregate";

const rice: IngredientContribution = {
  gramWeight: 200, // 200g cooked rice
  vectorPer100g: { kcal: 130, carbs: 28, protein: 2.7 },
};

const chicken: IngredientContribution = {
  gramWeight: 150,
  vectorPer100g: { kcal: 165, protein: 31, fat: 3.6, potassium: 256 },
};

describe("aggregateRecipeNutrients", () => {
  it("sums gram-scaled contributions and divides by servings", () => {
    const result = aggregateRecipeNutrients([rice, chicken], 0, 2);

    // totals: rice 200g → kcal 260, carbs 56, protein 5.4
    //         chicken 150g → kcal 247.5, protein 46.5, fat 5.4, potassium 384
    expect(result.total.kcal).toBeCloseTo(507.5);
    expect(result.total.protein).toBeCloseTo(51.9);
    expect(result.total.carbs).toBeCloseTo(56);
    expect(result.total.fat).toBeCloseTo(5.4);
    expect(result.total.potassium).toBeCloseTo(384);

    expect(result.perServing.kcal).toBeCloseTo(253.75);
    expect(result.perServing.potassium).toBeCloseTo(192);
  });

  it("keeps nutrients unknown to every ingredient absent from the result", () => {
    const result = aggregateRecipeNutrients([rice, chicken], 0, 2);
    expect("vitaminC" in result.total).toBe(false);
    expect("vitaminC" in result.perServing).toBe(false);
  });

  it("reports full coverage when every ingredient matched", () => {
    const result = aggregateRecipeNutrients([rice, chicken], 0, 2);
    expect(result.coverage).toBe("full");
    expect(result.matchedIngredients).toBe(2);
    expect(result.totalIngredients).toBe(2);
  });

  it("reports partial coverage when some ingredients are unmatched", () => {
    const result = aggregateRecipeNutrients([rice], 2, 1);
    expect(result.coverage).toBe("partial");
    expect(result.matchedIngredients).toBe(1);
    expect(result.totalIngredients).toBe(3);
  });

  it("reports macrosOnly when no ingredient matched", () => {
    const result = aggregateRecipeNutrients([], 4, 2);
    expect(result.coverage).toBe("macrosOnly");
    expect(result.total).toEqual({});
    expect(result.perServing).toEqual({});
    expect(result.matchedIngredients).toBe(0);
    expect(result.totalIngredients).toBe(4);
  });

  it("guards against zero or negative servings by treating them as 1", () => {
    const zero = aggregateRecipeNutrients([rice], 0, 0);
    expect(zero.perServing.kcal).toBeCloseTo(260);
    const negative = aggregateRecipeNutrients([rice], 0, -3);
    expect(negative.perServing.kcal).toBeCloseTo(260);
  });
});
