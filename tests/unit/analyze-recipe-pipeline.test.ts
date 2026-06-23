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
vi.mock("@/lib/recipe-analysis-repo", () => ({
  runRecipeStage2: vi.fn(),
  getRecipeAnalysisCached: vi.fn(),
  saveRecipeAnalysis: vi.fn(),
}));

import { type FdcFood } from "@/lib/fdc";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import {
  canonicalizeCached,
  getMacroEstimates,
} from "@/lib/ingredient-name-repo";
import {
  getRecipeAnalysisCached,
  runRecipeStage2,
  saveRecipeAnalysis,
} from "@/lib/recipe-analysis-repo";
import {
  analyzeRecipeAction,
  analyzeRecipeProfileAction,
} from "@/actions/analyzeRecipe";

const EMPTY_STAGE2 = { perIngredient: [], dietLabels: [], healthLabels: [] };

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
    { nutrientNumber: "307", amount: 100, unitName: "MG" }, // sodium (a micro)
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
  // Stage 2 + cache default to the flag-off behavior: no adjustment, no hit.
  vi.mocked(runRecipeStage2).mockResolvedValue(EMPTY_STAGE2);
  vi.mocked(getRecipeAnalysisCached).mockResolvedValue(null);
  vi.mocked(saveRecipeAnalysis).mockResolvedValue(undefined);
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

describe("LLM-primary pipeline · macro path (AnalyzeResult) is honest too", () => {
  it("carries status/source/coverage on the 5-macro result", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["tempeh sojowe", "tempeh"]])
    );

    const r = await analyzeRecipeAction({
      ingredients: ["100 g tempeh sojowe"],
      servings: 1,
    });

    expect(r.items[0].status).toBe("OK");
    expect(r.items[0].source).toBe("fdc");
    expect(r.coverage).toEqual({
      total: 1,
      resolved: 1,
      estimated: 0,
      unrecognized: 0,
    });
  });

  it("counts an ESTIMATED item's macros in the macro total", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["pasta miso", "miso paste"]])
    );
    vi.mocked(getMacroEstimates).mockResolvedValue(
      new Map([
        ["miso paste", { kcal: 199, protein: 12, fat: 6, carbs: 26, fiber: 5 }],
      ])
    );

    const r = await analyzeRecipeAction({
      ingredients: ["1.5 tsp pasta miso"],
      servings: 1,
    });

    expect(r.items[0].status).toBe("ESTIMATED");
    expect(r.items[0].source).toBe("llm_estimate");
    expect(r.items[0].macros.kcal).toBeGreaterThan(0);
    expect(r.total.kcal).toBeCloseTo(r.items[0].macros.kcal, 5);
  });
});

describe("LLM-primary pipeline · Stage 2 (cooked-weight + labels)", () => {
  it("applies retention to micronutrients only — energy + macros are conserved", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(new Map([["tempeh", "tempeh"]]));
    vi.mocked(runRecipeStage2).mockResolvedValue({
      perIngredient: [
        { name: "tempeh", cookedState: "cooked", retentionFactor: 0.5, confidence: 0.95, flagged: false },
      ],
      dietLabels: [],
      healthLabels: [],
    });

    const r = await analyzeRecipeProfileAction({ ingredients: ["100 g tempeh"], servings: 1 });

    expect(r.items[0].status).toBe("OK");
    expect(r.items[0].gramsTotal).toBe(100); // grams unchanged
    // Cooking conserves energy + macros — retention must NOT cut these.
    expect(r.perServing.calories).toBeCloseTo(192, 1);
    expect(r.perServing.protein).toBeCloseTo(20, 1);
    // Micronutrients ARE reduced by the retention factor (100 mg sodium * 0.5).
    expect(r.perServing.sodium).toBeCloseTo(50, 1);
    expect(r.items[0].cookedState).toBe("cooked");
    expect(r.items[0].cookedFlagged).toBe(false);
  });

  it("attaches recipe diet/health labels to the profile result", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(new Map([["tempeh", "tempeh"]]));
    vi.mocked(runRecipeStage2).mockResolvedValue({
      perIngredient: [],
      dietLabels: ["high-protein"],
      healthLabels: ["vegan"],
    });

    const r = await analyzeRecipeProfileAction({ ingredients: ["100 g tempeh"], servings: 1 });
    expect(r.dietLabels).toEqual(["high-protein"]);
    expect(r.healthLabels).toEqual(["vegan"]);
  });

  it("returns the cached analysis on a fingerprint hit, skipping the pipeline", async () => {
    vi.mocked(getRecipeAnalysisCached).mockResolvedValue({
      servings: 2,
      profile: {
        items: [],
        total: { ...zeroProfileLike(), calories: 400 },
        perServing: { ...zeroProfileLike(), calories: 200 },
      },
      stage2: { perIngredient: [], dietLabels: ["cached-label"], healthLabels: [] },
      coverage: { total: 1, resolved: 1, estimated: 0, unrecognized: 0 },
    });

    const r = await analyzeRecipeProfileAction({ ingredients: ["100 g tempeh"], servings: 2 });

    expect(r.success).toBe(true);
    expect(r.perServing.calories).toBe(200);
    expect(r.dietLabels).toEqual(["cached-label"]);
    // The pipeline was skipped: no USDA search, no Stage-2 call, no re-save.
    expect(searchFoodsCached).not.toHaveBeenCalled();
    expect(runRecipeStage2).not.toHaveBeenCalled();
    expect(saveRecipeAnalysis).not.toHaveBeenCalled();
  });

  it("saves a successful fresh analysis to the cache", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(new Map([["tempeh", "tempeh"]]));
    await analyzeRecipeProfileAction({ ingredients: ["100 g tempeh"], servings: 1 });
    expect(saveRecipeAnalysis).toHaveBeenCalledTimes(1);
  });
});

// Minimal zeroed 22-nutrient profile for cache-hit fixtures.
function zeroProfileLike() {
  return {
    calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, sugar: 0, sodium: 0,
    cholesterol: 0, saturatedFat: 0, transFat: 0, vitaminA: 0, vitaminC: 0,
    vitaminD: 0, vitaminE: 0, vitaminK: 0, vitaminB12: 0, folate: 0, iron: 0,
    calcium: 0, magnesium: 0, potassium: 0, zinc: 0,
  };
}

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
