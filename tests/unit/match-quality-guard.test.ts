import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fdcRepo", () => ({
  getFoodsCached: vi.fn(),
  searchFoodsCached: vi.fn(),
}));

import { type FdcFood } from "@/lib/fdc";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";

const clifBar: FdcFood = {
  fdcId: 999,
  description: "Clif Z bar",
  dataType: "Branded",
  foodNutrients: [
    { nutrientNumber: "208", amount: 400, unitName: "KCAL" },
    { nutrientNumber: "205", amount: 70, unitName: "G" },
  ],
};

const proteinBar: FdcFood = {
  fdcId: 1000,
  description: "Clif Z protein bar",
  dataType: "Branded",
  foodNutrients: [{ nutrientNumber: "208", amount: 350, unitName: "KCAL" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    [clifBar, proteinBar].filter((f) => ids.includes(f.fdcId))
  );
});

describe("match-quality guard in the analysis pipeline", () => {
  it("rejects a non-staple match that shares no token with the query (no silent wrong food)", async () => {
    vi.mocked(searchFoodsCached).mockResolvedValue([
      { fdcId: 999, description: "Clif Z bar", dataType: "Branded" },
    ]);

    const r = await analyzeRecipeProfileAction({
      ingredients: ["100 g wobblefish"],
      servings: 1,
    });

    expect(r.items[0].fdcId).toBeNull();
    expect(r.total.calories).toBe(0);
  });

  it("keeps a non-staple match that does share a content token", async () => {
    vi.mocked(searchFoodsCached).mockResolvedValue([
      { fdcId: 1000, description: "Clif Z protein bar", dataType: "Branded" },
    ]);

    const r = await analyzeRecipeProfileAction({
      ingredients: ["100 g protein bar"],
      servings: 1,
    });

    expect(r.items[0].fdcId).toBe(1000);
  });
});
