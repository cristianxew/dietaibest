import { describe, expect, it } from "vitest";
import {
  extractMacrosFromFood,
  extractProfileFromFood,
  type FdcFood,
} from "@/lib/fdc";

// USDA Foundation foods report Energy under the Atwater factor numbers
// (957 General, 958 Specific) and frequently OMIT 208. Reading only 208 zeroed
// their calories — the single biggest source of wrong recipe nutrition, since
// Foundation is the highest-priority match.
const foundationSpinach: FdcFood = {
  fdcId: 1999632,
  description: "Spinach, baby",
  dataType: "Foundation",
  foodNutrients: [
    { nutrient: { number: "957", name: "Energy (Atwater General Factors)", unitName: "kcal" }, amount: 26.602 },
    { nutrient: { number: "958", name: "Energy (Atwater Specific Factors)", unitName: "kcal" }, amount: 20.728 },
    { nutrient: { number: "203", unitName: "g" }, amount: 2.85 },
    { nutrient: { number: "204", unitName: "g" }, amount: 0.62 },
    { nutrient: { number: "205", unitName: "g" }, amount: 2.41 },
    { nutrient: { number: "291", unitName: "g" }, amount: 1.56 },
  ],
};

describe("fdc energy extraction · Atwater fallback (Foundation foods)", () => {
  it("extractProfileFromFood reads Atwater General (957) when 208 is absent", () => {
    expect(extractProfileFromFood(foundationSpinach).calories).toBeCloseTo(26.602, 2);
  });

  it("extractMacrosFromFood reads Atwater General (957) when 208 is absent", () => {
    expect(extractMacrosFromFood(foundationSpinach).kcal).toBeCloseTo(26.602, 2);
  });

  it("prefers 208 over Atwater when both are present (FNDDS/SR Legacy/Branded)", () => {
    const fndds: FdcFood = {
      fdcId: 1,
      description: "Cereal, wheat flakes",
      dataType: "Survey (FNDDS)",
      foodNutrients: [
        { nutrient: { number: "208", unitName: "kcal" }, amount: 359 },
        { nutrient: { number: "957", unitName: "kcal" }, amount: 999 },
        { nutrient: { number: "203", unitName: "g" }, amount: 10.1 },
      ],
    };
    expect(extractProfileFromFood(fndds).calories).toBe(359);
    expect(extractMacrosFromFood(fndds).kcal).toBe(359);
  });

  it("falls back to Atwater Specific (958) if it is the only energy present", () => {
    const only958: FdcFood = {
      fdcId: 2,
      description: "x",
      dataType: "Foundation",
      foodNutrients: [
        { nutrient: { number: "958", unitName: "kcal" }, amount: 42 },
        { nutrient: { number: "205", unitName: "g" }, amount: 5 },
      ],
    };
    expect(extractProfileFromFood(only958).calories).toBe(42);
  });
});
