import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only the network leaves: keep the real pure extract/scale/add/divide.
vi.mock("@/lib/fdc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/fdc")>();
  return { ...actual, fdcSearch: vi.fn() };
});
vi.mock("@/lib/fdcRepo", () => ({ getFoodsCached: vi.fn() }));

import { fdcSearch, type FdcFood } from "@/lib/fdc";
import { getFoodsCached } from "@/lib/fdcRepo";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";

const spinachFood: FdcFood = {
  fdcId: 168462,
  description: "Spinach, raw",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrientNumber: "208", amount: 23, unitName: "KCAL" },
    { nutrientNumber: "203", amount: 2.86, unitName: "G" },
    { nutrientNumber: "307", amount: 79, unitName: "MG" },
  ],
};

const chickenFood: FdcFood = {
  fdcId: 171077,
  description: "Chicken breast, raw",
  dataType: "SR Legacy",
  foodNutrients: [
    { nutrientNumber: "208", amount: 165, unitName: "KCAL" },
    { nutrientNumber: "203", amount: 31, unitName: "G" },
    { nutrientNumber: "307", amount: 74, unitName: "MG" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fdcSearch).mockImplementation(async (q: string) => {
    if (q.includes("spinach"))
      return { foods: [{ fdcId: 168462, description: "Spinach, raw", dataType: "SR Legacy" }] };
    if (q.includes("chicken"))
      return { foods: [{ fdcId: 171077, description: "Chicken breast, raw", dataType: "SR Legacy" }] };
    return { foods: [] };
  });
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    [spinachFood, chickenFood].filter((f) => ids.includes(f.fdcId))
  );
});

describe("analyzeRecipeProfileAction — full-profile aggregation", () => {
  it("scales each ingredient by grams, sums them, and divides per serving", async () => {
    const r = await analyzeRecipeProfileAction({
      ingredients: ["200 g spinach", "100 g chicken breast"],
      servings: 2,
    });

    expect(r.success).toBe(true);

    // total = spinach(×2.0) + chicken(×1.0)
    expect(r.total.calories).toBeCloseTo(23 * 2 + 165, 5); // 211
    expect(r.total.protein).toBeCloseTo(2.86 * 2 + 31, 5); // 36.72
    expect(r.total.sodium).toBeCloseTo(79 * 2 + 74, 5); // 232

    // perServing = total / 2
    expect(r.perServing.calories).toBeCloseTo(105.5, 5);
    expect(r.perServing.protein).toBeCloseTo(18.36, 5);
    expect(r.perServing.sodium).toBeCloseTo(116, 5);
  });

  it("returns per-ingredient items carrying the RecipeIngredient fields", async () => {
    const r = await analyzeRecipeProfileAction({
      ingredients: ["200 g spinach"],
      servings: 1,
    });

    expect(r.items).toHaveLength(1);
    const sp = r.items[0];
    expect(sp.fdcId).toBe(168462);
    expect(sp.gramsTotal).toBe(200);
    expect(sp.nameNorm).toContain("spinach");
    expect(sp.qty).toBe(200);
    expect(sp.unit).toBe("g");
    expect(sp.confidence).toBeGreaterThan(0);
  });

  it("lets an unmatched ingredient contribute zeros without breaking", async () => {
    vi.mocked(fdcSearch).mockResolvedValue({ foods: [] });
    const r = await analyzeRecipeProfileAction({
      ingredients: ["1 cup zzzznotafood"],
      servings: 1,
    });

    expect(r.success).toBe(true);
    expect(r.total.calories).toBe(0);
    expect(r.items[0].fdcId).toBeNull();
  });

  it("fails gracefully when no ingredients are provided", async () => {
    const r = await analyzeRecipeProfileAction({ ingredients: [], servings: 2 });
    expect(r.success).toBe(false);
    expect(r.perServing.calories).toBe(0);
  });
});
