import { describe, it, expect, vi } from "vitest";

// Pure-function tests — the Prisma loader in the same module is not exercised.
vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

import {
  mergeGenerationTargets,
  type GenerationProfile,
} from "@/lib/meal-plan/generation-profile";

const profile: GenerationProfile = {
  dailyCalories: 2100,
  proteinGrams: 150,
  carbsGrams: 220,
  fatGrams: 70,
  dietaryType: ["vegetarian"],
  allergies: [" Peanut ", "peanut", "shellfish"],
};

describe("mergeGenerationTargets", () => {
  it("falls back to profile targets, preferences and allergies when the input has none", () => {
    const merged = mergeGenerationTargets({}, profile);
    expect(merged).toEqual({
      targetCalories: 2100,
      targetProtein: 150,
      targetCarbs: 220,
      targetFat: 70,
      dietary: ["vegetarian"],
      allergies: ["Peanut", "shellfish"],
    });
  });

  it("lets explicit input win per field", () => {
    const merged = mergeGenerationTargets({ targetCalories: 1800 }, profile);
    expect(merged.targetCalories).toBe(1800);
    expect(merged.targetProtein).toBe(150);
  });

  it("unions dietary preferences without case-insensitive duplicates", () => {
    const merged = mergeGenerationTargets(
      { dietary: ["Vegetarian", "gluten-free"] },
      profile
    );
    expect(merged.dietary).toEqual(["Vegetarian", "gluten-free"]);
  });

  it("treats zero or negative profile values as unset", () => {
    const merged = mergeGenerationTargets(
      {},
      { ...profile, dailyCalories: 0, proteinGrams: -5 }
    );
    expect(merged.targetCalories).toBeUndefined();
    expect(merged.targetProtein).toBeUndefined();
    expect(merged.targetCarbs).toBe(220);
  });

  it("works without a profile", () => {
    const merged = mergeGenerationTargets({ days: 3 } as never, null);
    expect(merged.targetCalories).toBeUndefined();
    expect(merged.dietary).toBeUndefined();
    expect(merged.allergies).toEqual([]);
  });
});
