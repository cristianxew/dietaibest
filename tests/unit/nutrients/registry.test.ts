import { describe, it, expect } from "vitest";
import {
  NUTRIENT_REGISTRY,
  EXTENDED_NUTRIENT_NUMBERS,
  type NutrientKey,
  type NutrientDef,
} from "@/lib/nutrients/registry";

const ALL_KEYS: NutrientKey[] = [
  "kcal",
  "protein",
  "fat",
  "carbs",
  "fiber",
  "sugar",
  "satFat",
  "cholesterol",
  "sodium",
  "potassium",
  "calcium",
  "iron",
  "magnesium",
  "zinc",
  "vitaminA",
  "vitaminC",
  "vitaminD",
  "vitaminE",
  "vitaminK",
  "vitaminB6",
  "vitaminB12",
  "folate",
];

describe("NUTRIENT_REGISTRY", () => {
  it("contains exactly the 22 expected nutrient keys", () => {
    expect(Object.keys(NUTRIENT_REGISTRY).sort()).toEqual([...ALL_KEYS].sort());
  });

  it("every definition is self-consistent (key matches, has usdaNumbers, unit, group, direction)", () => {
    for (const key of ALL_KEYS) {
      const def: NutrientDef = NUTRIENT_REGISTRY[key];
      expect(def.key).toBe(key);
      expect(def.usdaNumbers.length).toBeGreaterThan(0);
      expect(["kcal", "g", "mg", "ug"]).toContain(def.unit);
      expect(["energy", "macro", "fatProfile", "mineral", "vitamin"]).toContain(
        def.group
      );
      expect(["goal", "limit", "neutral"]).toContain(def.direction);
    }
  });

  it("USDA numbers are unique across the registry", () => {
    const all = Object.values(NUTRIENT_REGISTRY).flatMap((d) => d.usdaNumbers);
    expect(new Set(all).size).toBe(all.length);
  });

  it("keeps the original core macro numbers intact", () => {
    expect(NUTRIENT_REGISTRY.kcal.usdaNumbers).toContain("208");
    expect(NUTRIENT_REGISTRY.protein.usdaNumbers).toContain("203");
    expect(NUTRIENT_REGISTRY.fat.usdaNumbers).toContain("204");
    expect(NUTRIENT_REGISTRY.carbs.usdaNumbers).toContain("205");
    expect(NUTRIENT_REGISTRY.fiber.usdaNumbers).toContain("291");
  });

  it("marks limit nutrients (less is better) per FDA guidance", () => {
    expect(NUTRIENT_REGISTRY.sodium.direction).toBe("limit");
    expect(NUTRIENT_REGISTRY.satFat.direction).toBe("limit");
    expect(NUTRIENT_REGISTRY.cholesterol.direction).toBe("limit");
    expect(NUTRIENT_REGISTRY.sugar.direction).toBe("limit");
  });

  it("marks energy-balance nutrients neutral and the rest as goals", () => {
    expect(NUTRIENT_REGISTRY.kcal.direction).toBe("neutral");
    expect(NUTRIENT_REGISTRY.carbs.direction).toBe("neutral");
    expect(NUTRIENT_REGISTRY.fat.direction).toBe("neutral");
    expect(NUTRIENT_REGISTRY.protein.direction).toBe("goal");
    expect(NUTRIENT_REGISTRY.fiber.direction).toBe("goal");
    expect(NUTRIENT_REGISTRY.potassium.direction).toBe("goal");
  });

  it("uses correct units for spot-checked nutrients", () => {
    expect(NUTRIENT_REGISTRY.kcal.unit).toBe("kcal");
    expect(NUTRIENT_REGISTRY.potassium.unit).toBe("mg");
    expect(NUTRIENT_REGISTRY.vitaminD.unit).toBe("ug");
    expect(NUTRIENT_REGISTRY.folate.unit).toBe("ug");
    expect(NUTRIENT_REGISTRY.protein.unit).toBe("g");
  });
});

describe("EXTENDED_NUTRIENT_NUMBERS", () => {
  it("flattens every registry number exactly once", () => {
    const fromRegistry = Object.values(NUTRIENT_REGISTRY).flatMap(
      (d) => d.usdaNumbers
    );
    expect([...EXTENDED_NUTRIENT_NUMBERS].sort()).toEqual(fromRegistry.sort());
  });

  it("stays under the FDC API cap of 25 nutrient numbers", () => {
    expect(EXTENDED_NUTRIENT_NUMBERS.length).toBeLessThanOrEqual(25);
  });

  it("includes the 5 core macro numbers (backward compatibility)", () => {
    for (const num of ["208", "203", "204", "205", "291"]) {
      expect(EXTENDED_NUTRIENT_NUMBERS).toContain(num);
    }
  });
});
