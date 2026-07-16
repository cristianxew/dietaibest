/**
 * Resolve stage — the DECIDE half of the Resolve / Compute seam.
 *
 * Exercises `resolveIngredients` directly through its mocked seams and asserts on
 * the per-ingredient `IngredientResolution` records — the new test surface the
 * extraction unlocked. Before this, the resolution decisions could only be
 * observed indirectly through a full `analyzeRecipe*Action` call; here we pin the
 * status/source/food/grams of each record at the interface.
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
}));

import { type FdcFood } from "@/lib/fdc";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import {
  canonicalizeCached,
  getMacroEstimates,
} from "@/lib/ingredient-name-repo";
import { runRecipeStage2 } from "@/lib/recipe-analysis-repo";
import { resolveIngredients } from "@/lib/nutrition/resolve-ingredients";

const EMPTY_STAGE2 = { perIngredient: [], dietLabels: [], healthLabels: [] };

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

// The curated staple pin for "chicken" (STAPLE_FDC_IDS.chicken = 171077,
// "Chicken, breast, ... raw"). Carries energy so it survives the energy guard.
const CHICKEN_STAPLE_ID = 171077;
const chicken: FdcFood = {
  fdcId: CHICKEN_STAPLE_ID,
  description: "Chicken, breast, skinless, boneless, meat only, raw",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrientNumber: "208", amount: 120, unitName: "KCAL" },
    { nutrientNumber: "203", amount: 23, unitName: "G" },
    { nutrientNumber: "204", amount: 2.6, unitName: "G" },
    { nutrientNumber: "205", amount: 0, unitName: "G" },
    { nutrientNumber: "291", amount: 0, unitName: "G" },
  ],
};

/** A Stage-2 per-ingredient record with sensible defaults; override per test. */
function stage2Item(
  overrides: Partial<{
    name: string;
    chosenFdcId: number | null;
    grams: number | null;
    cookedState: "raw" | "cooked";
    retentionFactor: number;
    confidence: number;
    flagged: boolean;
  }>
) {
  return {
    name: "chicken",
    chosenFdcId: null,
    grams: null,
    cookedState: "raw" as const,
    retentionFactor: 1,
    confidence: 0.9,
    flagged: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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
  vi.mocked(runRecipeStage2).mockResolvedValue(EMPTY_STAGE2);
});

describe("resolveIngredients · record interface", () => {
  it("resolves a canonical → FDC match as an OK/fdc record carrying the food + grams", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["tempeh sojowe", "tempeh"]])
    );

    const { resolutions } = await resolveIngredients(["100 g tempeh sojowe"]);
    const r = resolutions[0];

    expect(r.status).toBe("OK");
    expect(r.source).toBe("fdc");
    if (r.status !== "OK") throw new Error("expected OK");
    expect(r.food.fdcId).toBe(1001);
    expect(r.grams).toBe(100);
  });

  it("falls to an ESTIMATED/llm_estimate record when no USDA food matches", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["pasta miso", "miso paste"]])
    );
    vi.mocked(getMacroEstimates).mockResolvedValue(
      new Map([
        ["miso paste", { kcal: 199, protein: 12, fat: 6, carbs: 26, fiber: 5 }],
      ])
    );

    const { resolutions } = await resolveIngredients(["1.5 tsp pasta miso"]);
    const r = resolutions[0];

    expect(r.status).toBe("ESTIMATED");
    expect(r.source).toBe("llm_estimate");
    if (r.status !== "ESTIMATED") throw new Error("expected ESTIMATED");
    expect(r.estimate.kcal).toBe(199);
    expect(r.grams).toBeGreaterThan(0);
  });

  it("surfaces an LLM non-food (canonical null) as an UNRECOGNIZED/none record", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["posiłek 1", null]])
    );

    const { resolutions } = await resolveIngredients(["Posiłek 1"]);
    const r = resolutions[0];

    expect(r.status).toBe("UNRECOGNIZED");
    expect(r.source).toBe("none");
  });

  it("returns one record per non-empty line, aligned in order", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([
        ["tempeh sojowe", "tempeh"],
        ["posiłek 1", null],
      ])
    );

    const { resolutions } = await resolveIngredients([
      "100 g tempeh sojowe",
      "",
      "Posiłek 1",
    ]);

    expect(resolutions).toHaveLength(2);
    expect(resolutions[0].status).toBe("OK");
    expect(resolutions[1].status).toBe("UNRECOGNIZED");
  });
});

describe("resolveIngredients · staple backstop (ADR 0004 addendum)", () => {
  beforeEach(() => {
    // Search returns nothing useful — the curated chicken staple is pinned ahead
    // of search, fetched, and bypasses the match guard (so it lands as batch.food).
    vi.mocked(searchFoodsCached).mockResolvedValue([]);
    vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
      [chicken].filter((f) => ids.includes(f.fdcId))
    );
  });

  it("recovers the curated staple when Stage-2 abstains BY FAILURE (flagged null)", async () => {
    vi.mocked(runRecipeStage2).mockResolvedValue({
      perIngredient: [stage2Item({ chosenFdcId: null, confidence: 0, flagged: true })],
      dietLabels: [],
      healthLabels: [],
    });

    const { resolutions } = await resolveIngredients(["200 g chicken"]);
    const r = resolutions[0];

    expect(r.status).toBe("OK");
    expect(r.source).toBe("fdc");
    if (r.status !== "OK") throw new Error("expected OK");
    expect(r.food.fdcId).toBe(CHICKEN_STAPLE_ID);
    // Provenance stays honest: the LLM did not pick it, the staple backstop did.
    expect(r.trace?.selectedVia).toBe("staple-backstop");
  });

  it("leaves a CONFIDENT Stage-2 null sovereign — does NOT override it with the staple", async () => {
    // flagged:false → a deliberate "no candidate is a reasonable match". The LLM
    // saw the pinned staple among the candidates and rejected it; we honor that.
    vi.mocked(runRecipeStage2).mockResolvedValue({
      perIngredient: [stage2Item({ chosenFdcId: null, confidence: 0.9, flagged: false })],
      dietLabels: [],
      healthLabels: [],
    });
    vi.mocked(getMacroEstimates).mockResolvedValue(
      new Map([["chicken", { kcal: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0 }]])
    );

    const { resolutions } = await resolveIngredients(["200 g chicken"]);
    const r = resolutions[0];

    expect(r.status).toBe("ESTIMATED");
    expect(r.source).toBe("llm_estimate");
  });

  it("does NOT recover a NON-staple deterministic pick on a flagged null (staple-pin-only)", async () => {
    // tempeh is not in the staple map, yet it resolves deterministically to a
    // real FDC food (1001). A flagged null must still fall to estimate — a plain
    // search match has no cooked/raw vetting, so trusting it could reopen the trap.
    vi.mocked(searchFoodsCached).mockResolvedValue([
      { fdcId: 1001, description: "Tempeh", dataType: "SR Legacy" },
    ]);
    vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
      [tempeh].filter((f) => ids.includes(f.fdcId))
    );
    vi.mocked(runRecipeStage2).mockResolvedValue({
      perIngredient: [stage2Item({ name: "tempeh", chosenFdcId: null, confidence: 0, flagged: true })],
      dietLabels: [],
      healthLabels: [],
    });
    vi.mocked(getMacroEstimates).mockResolvedValue(
      new Map([["tempeh", { kcal: 192, protein: 20, fat: 11, carbs: 8, fiber: 0 }]])
    );

    const { resolutions } = await resolveIngredients(["100 g tempeh"]);
    const r = resolutions[0];

    expect(r.status).toBe("ESTIMATED");
    expect(r.source).toBe("llm_estimate");
  });
});
