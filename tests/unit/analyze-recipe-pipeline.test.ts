/**
 * LLM-primary nutrition pipeline — honest output contract (ADR 0003).
 *
 * Exercises `analyzeRecipeProfileAction` through its two mocked seams:
 *  - `@/lib/fdcRepo`            (USDA search + fetch)
 *  - `@/lib/ingredient-name-repo` (LLM canonicalization + macro estimates)
 *
 * Asserts the single-pass canonicalize-first flow and the per-ingredient
 * status/source contract: OK/fdc, ESTIMATED/llm_estimate, UNRECOGNIZED/none,
 * plus the recipe-level coverage summary. A no-match is NEVER silently folded
 * into the total as a confident zero — it is surfaced.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fdcRepo", () => ({
  getFoodsCached: vi.fn(),
  searchFoodsCached: vi.fn(),
}));
vi.mock("@/lib/ingredient-name-repo", () => ({
  canonicalizeCached: vi.fn(),
  getMacroEstimates: vi.fn(),
}));

import { type FdcFood } from "@/lib/fdc";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import {
  canonicalizeCached,
  getMacroEstimates,
} from "@/lib/ingredient-name-repo";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";

// A non-staple food with a token shared with its canonical name, so the
// `matchPlausible` guard accepts it.
const tempeh: FdcFood = {
  fdcId: 1001,
  description: "Tempeh",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrientNumber: "208", amount: 192, unitName: "KCAL" },
    { nutrientNumber: "203", amount: 20, unitName: "G" },
    { nutrientNumber: "204", amount: 11, unitName: "G" },
    { nutrientNumber: "205", amount: 8, unitName: "G" },
    { nutrientNumber: "291", amount: 0, unitName: "G" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: search yields the tempeh food only for a "tempeh" query, nothing
  // else; fetch resolves it by id. Individual tests override canonical/estimate.
  vi.mocked(searchFoodsCached).mockImplementation(async (q: string) =>
    q.includes("tempeh")
      ? [{ fdcId: 1001, description: "Tempeh", dataType: "SR Legacy" }]
      : []
  );
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    [tempeh].filter((f) => ids.includes(f.fdcId))
  );
  vi.mocked(canonicalizeCached).mockResolvedValue(new Map());
  vi.mocked(getMacroEstimates).mockResolvedValue(new Map());
});

describe("LLM-primary pipeline · OK (canonical → FDC, single pass)", () => {
  it("canonicalizes a foreign name, matches USDA, and reports OK/fdc", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["tempeh sojowe", "tempeh"]])
    );

    const r = await analyzeRecipeProfileAction({
      ingredients: ["100 g tempeh sojowe"],
      servings: 1,
    });

    expect(r.success).toBe(true);
    expect(r.items[0].status).toBe("OK");
    expect(r.items[0].source).toBe("fdc");
    expect(r.items[0].fdcId).toBe(1001);
    expect(r.items[0].gramsTotal).toBe(100);
    expect(r.perServing.calories).toBeCloseTo(192, 1);
    expect(r.coverage).toEqual({
      total: 1,
      resolved: 1,
      estimated: 0,
      unrecognized: 0,
    });
  });
});

describe("LLM-primary pipeline · ESTIMATED (canonical food, no USDA match)", () => {
  it("uses the LLM macro estimate, flags it, and counts it in the total", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["pasta miso", "miso paste"]])
    );
    vi.mocked(getMacroEstimates).mockResolvedValue(
      new Map([
        ["miso paste", { kcal: 199, protein: 12, fat: 6, carbs: 26, fiber: 5 }],
      ])
    );

    const r = await analyzeRecipeProfileAction({
      ingredients: ["1.5 tsp pasta miso"],
      servings: 1,
    });

    expect(r.items[0].status).toBe("ESTIMATED");
    expect(r.items[0].source).toBe("llm_estimate");
    expect(r.items[0].fdcId).toBeNull();
    expect(r.items[0].gramsTotal).toBeGreaterThan(0);
    // The estimate flows into the total (counted-but-flagged), tied to grams.
    expect(r.perServing.calories).toBeCloseTo(
      (199 * r.items[0].gramsTotal) / 100,
      5
    );
    // Micros stay 0 — only the macros are known.
    expect(r.perServing.sodium).toBe(0);
    expect(r.coverage).toEqual({
      total: 1,
      resolved: 0,
      estimated: 1,
      unrecognized: 0,
    });
  });
});

describe("LLM-primary pipeline · UNRECOGNIZED (honest gap, never silent zero)", () => {
  it("marks a non-food (LLM canonical = null) as UNRECOGNIZED, contributing 0", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["posiłek 1", null]])
    );

    const r = await analyzeRecipeProfileAction({
      ingredients: ["Posiłek 1"],
      servings: 1,
    });

    expect(r.items[0].status).toBe("UNRECOGNIZED");
    expect(r.items[0].source).toBe("none");
    expect(r.items[0].fdcId).toBeNull();
    expect(r.items[0].gramsTotal).toBe(0);
    expect(r.perServing.calories).toBe(0);
    expect(r.coverage.unrecognized).toBe(1);
    expect(r.coverage.resolved).toBe(0);
  });

  it("marks a food with no USDA match AND no estimate as UNRECOGNIZED", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["obscurefood", "obscurething"]])
    );
    vi.mocked(getMacroEstimates).mockResolvedValue(
      new Map([["obscurething", null]])
    );

    const r = await analyzeRecipeProfileAction({
      ingredients: ["50 g obscurefood"],
      servings: 1,
    });

    expect(r.items[0].status).toBe("UNRECOGNIZED");
    expect(r.items[0].source).toBe("none");
    expect(r.perServing.calories).toBe(0);
  });
});

describe("LLM-primary pipeline · coverage over a mixed recipe", () => {
  it("summarizes OK + ESTIMATED + UNRECOGNIZED and only counts real nutrition", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([
        ["tempeh sojowe", "tempeh"],
        ["pasta miso", "miso paste"],
        ["posiłek 1", null],
      ])
    );
    vi.mocked(getMacroEstimates).mockResolvedValue(
      new Map([
        ["miso paste", { kcal: 199, protein: 12, fat: 6, carbs: 26, fiber: 5 }],
      ])
    );

    const r = await analyzeRecipeProfileAction({
      ingredients: ["100 g tempeh sojowe", "1.5 tsp pasta miso", "Posiłek 1"],
      servings: 1,
    });

    expect(r.coverage).toEqual({
      total: 3,
      resolved: 1,
      estimated: 1,
      unrecognized: 1,
    });
    // Total = tempeh (FDC) + miso (estimate); the unrecognized item adds nothing.
    const misoKcal = (199 * (r.items[1].gramsTotal as number)) / 100;
    expect(r.total.calories).toBeCloseTo(192 + misoKcal, 4);
  });
});
