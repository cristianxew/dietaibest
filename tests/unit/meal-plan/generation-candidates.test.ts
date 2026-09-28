import { describe, it, expect, vi } from "vitest";

// Pure-function tests — the Prisma loader in the same module is not exercised.
vi.mock("@/lib/prisma", () => ({ default: {}, prisma: {} }));

import {
  excludeAllergens,
  formatCandidatesForPrompt,
  pickCandidate,
  type CandidateRecipe,
} from "@/lib/meal-plan/generation-candidates";

function recipe(overrides: Partial<CandidateRecipe> & { id: string }): CandidateRecipe {
  return {
    title: `Recipe ${overrides.id}`,
    description: null,
    tags: [],
    calories: 450,
    protein: 30,
    carbs: 40,
    fat: 15,
    ...overrides,
  };
}

const pool: CandidateRecipe[] = [
  recipe({ id: "a", title: "Peanut noodles" }),
  recipe({ id: "b", title: "Salmon bowl", tags: ["fish", "Shellfish-free"] }),
  recipe({ id: "c", title: "Oat porridge", calories: null, protein: null, carbs: null, fat: null }),
];

describe("excludeAllergens", () => {
  it("drops recipes whose title or tags mention an allergen, case-insensitively", () => {
    expect(excludeAllergens(pool, ["PEANUT"]).map((r) => r.id)).toEqual(["b", "c"]);
    expect(excludeAllergens(pool, ["fish"]).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("returns the pool untouched when there are no allergies", () => {
    expect(excludeAllergens(pool, [])).toBe(pool);
    expect(excludeAllergens(pool, ["  "])).toEqual(pool);
  });
});

describe("formatCandidatesForPrompt", () => {
  it("labels each line with the ORIGINAL index even when the presentation is rotated", () => {
    const lines = formatCandidatesForPrompt(pool, 1).split("\n");
    expect(lines[0]).toMatch(/^#1 Salmon bowl/);
    expect(lines[1]).toMatch(/^#2 Oat porridge/);
    expect(lines[2]).toMatch(/^#0 Peanut noodles/);
  });

  it("renders per-serving macros, tags, and an 'unknown' marker for unanalyzed recipes", () => {
    const text = formatCandidatesForPrompt(pool);
    expect(text).toContain("#0 Peanut noodles | 450 kcal/serving P30 C40 F15");
    expect(text).toContain("| fish, Shellfish-free");
    expect(text).toContain("#2 Oat porridge | macros unknown");
  });

  it("returns an empty string for an empty pool", () => {
    expect(formatCandidatesForPrompt([], 3)).toBe("");
  });
});

describe("pickCandidate", () => {
  it("resolves an in-range integer index", () => {
    expect(pickCandidate(pool, 2)?.id).toBe("c");
  });

  it("returns null for anything that is not a valid index", () => {
    for (const bad of [-1, 3, 1.5, "0", undefined, null, NaN]) {
      expect(pickCandidate(pool, bad)).toBeNull();
    }
  });
});
