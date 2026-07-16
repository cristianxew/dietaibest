import { describe, expect, it } from "vitest";
import {
  extractProfileFromFood,
  scaleProfilePer100g,
  addProfile,
  divideProfile,
  zeroProfile,
  PROFILE_NUTRIENT_MAP,
  type Profile,
  type FdcFood,
} from "@/lib/fdc";

const PROFILE_KEYS = Object.keys(PROFILE_NUTRIENT_MAP) as (keyof Profile)[];

/**
 * Build a minimal FdcFood from a `{ nutrientNumber: [amount, unitName] }` spec.
 * Mirrors the abridged FDC payload shape the extractor reads.
 */
function food(nutrients: Record<string, [number, string]>): FdcFood {
  return {
    fdcId: 1,
    description: "test food",
    dataType: "Foundation",
    foodNutrients: Object.entries(nutrients).map(
      ([number, [amount, unitName]]) => ({
        nutrientNumber: number,
        amount,
        unitName,
      })
    ),
  };
}

describe("extractProfileFromFood — nutrient-number mapping", () => {
  it("maps all 22 FDC nutrient numbers to the correct profile fields (per 100g)", () => {
    const f = food({
      "208": [165, "KCAL"],
      "203": [31, "G"],
      "204": [3.6, "G"],
      "205": [12, "G"],
      "291": [2.1, "G"],
      "269": [0.5, "G"],
      "307": [74, "MG"],
      "601": [85, "MG"],
      "606": [1.0, "G"],
      "605": [0.1, "G"],
      "320": [6, "UG"],
      "401": [4, "MG"],
      "328": [0.2, "UG"],
      "323": [0.3, "MG"],
      "430": [2, "UG"],
      "418": [0.3, "UG"],
      "417": [12, "UG"],
      "303": [1.0, "MG"],
      "301": [15, "MG"],
      "304": [29, "MG"],
      "306": [256, "MG"],
      "309": [1.0, "MG"],
    });

    const p = extractProfileFromFood(f);

    expect(p).toEqual<Profile>({
      calories: 165,
      protein: 31,
      fat: 3.6,
      carbs: 12,
      fiber: 2.1,
      sugar: 0.5,
      sodium: 74,
      cholesterol: 85,
      saturatedFat: 1.0,
      transFat: 0.1,
      vitaminA: 6,
      vitaminC: 4,
      vitaminD: 0.2,
      vitaminE: 0.3,
      vitaminK: 2,
      vitaminB12: 0.3,
      folate: 12,
      iron: 1.0,
      calcium: 15,
      magnesium: 29,
      potassium: 256,
      zinc: 1.0,
    });
  });

  it("returns 0 (not NaN/undefined) for nutrients absent from the payload", () => {
    const p = extractProfileFromFood(food({ "203": [10, "G"] }));
    expect(p.protein).toBe(10);
    for (const key of PROFILE_KEYS) {
      expect(Number.isNaN(p[key])).toBe(false);
      if (key !== "protein") expect(p[key]).toBe(0);
    }
  });

  it("does not read the Vitamin A IU number (318) — only RAE (320)", () => {
    // 318 present, 320 absent: vitaminA must stay 0, never leak an IU value.
    const p = extractProfileFromFood(food({ "318": [5000, "IU"] }));
    expect(p.vitaminA).toBe(0);
  });

  it("rejects a nutrient reported in an unexpected unit (sodium in g)", () => {
    // 307 is sodium but reported in grams instead of mg → wrong magnitude.
    const p = extractProfileFromFood(food({ "307": [0.074, "G"] }));
    expect(p.sodium).toBe(0);
  });

  it("guards mineral numbers against off-by-one shifts (spinach magnitudes)", () => {
    // Raw spinach (fdcId 168462) per-100g reference values. If calcium/iron/
    // magnesium/potassium numbers were swapped, the magnitudes would diverge.
    const spinach = food({
      "208": [23, "KCAL"],
      "203": [2.86, "G"],
      "301": [99, "MG"], // calcium
      "303": [2.71, "MG"], // iron
      "304": [79, "MG"], // magnesium
      "306": [558, "MG"], // potassium
      "307": [79, "MG"], // sodium
      "401": [28.1, "MG"], // vitamin C
    });
    const p = extractProfileFromFood(spinach);
    expect(p.calcium).toBe(99);
    expect(p.iron).toBe(2.71);
    expect(p.magnesium).toBe(79);
    expect(p.potassium).toBe(558);
    expect(p.sodium).toBe(79);
    expect(p.vitaminC).toBe(28.1);
  });
});

describe("profile scaling & aggregation", () => {
  it("scaleProfilePer100g scales every field by grams/100", () => {
    const per100g = extractProfileFromFood(
      food({ "208": [100, "KCAL"], "203": [10, "G"], "307": [50, "MG"] })
    );
    const scaled = scaleProfilePer100g(per100g, 250);
    expect(scaled.calories).toBe(250);
    expect(scaled.protein).toBe(25);
    expect(scaled.sodium).toBe(125);
  });

  it("addProfile sums field-wise across all 22 fields", () => {
    const a = extractProfileFromFood(
      food({ "208": [100, "KCAL"], "301": [20, "MG"] })
    );
    const b = extractProfileFromFood(
      food({ "208": [50, "KCAL"], "301": [5, "MG"] })
    );
    const sum = addProfile(a, b);
    expect(sum.calories).toBe(150);
    expect(sum.calcium).toBe(25);
    // every field is the sum of its two inputs
    for (const key of PROFILE_KEYS) {
      expect(sum[key]).toBe(a[key] + b[key]);
    }
  });

  it("divideProfile divides field-wise (per serving)", () => {
    const total = extractProfileFromFood(
      food({ "208": [400, "KCAL"], "306": [800, "MG"] })
    );
    const perServing = divideProfile(total, 4);
    expect(perServing.calories).toBe(100);
    expect(perServing.potassium).toBe(200);
  });

  it("divideProfile treats a 0 divisor as 1 (no NaN/Infinity)", () => {
    const total = extractProfileFromFood(food({ "208": [400, "KCAL"] }));
    const out = divideProfile(total, 0);
    expect(out.calories).toBe(400);
  });

  it("zeroProfile is the additive identity", () => {
    const z = zeroProfile();
    for (const key of PROFILE_KEYS) expect(z[key]).toBe(0);
  });
});
