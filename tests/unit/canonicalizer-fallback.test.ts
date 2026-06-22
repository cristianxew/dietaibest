import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/fdcRepo", () => ({
  getFoodsCached: vi.fn(),
  searchFoodsCached: vi.fn(),
}));
vi.mock("@/lib/ingredient-name-repo", () => ({
  canonicalizeCached: vi.fn(),
}));

import { type FdcFood } from "@/lib/fdc";
import { getFoodsCached, searchFoodsCached } from "@/lib/fdcRepo";
import { canonicalizeCached } from "@/lib/ingredient-name-repo";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";

const salmon: FdcFood = {
  fdcId: 173686,
  description: "Fish, salmon, Atlantic, wild, raw",
  dataType: "SR Legacy",
  foodNutrients: [{ nutrientNumber: "208", amount: 142, unitName: "KCAL" }],
};
const junk: FdcFood = {
  fdcId: 999,
  description: "Clif Z bar",
  dataType: "Branded",
  foodNutrients: [{ nutrientNumber: "208", amount: 400, unitName: "KCAL" }],
};

// "lachsfilet" (German) is not in the synonym map → pass 1 can never resolve it.
// The mock returns salmon results only when the query contains "salmon", so
// pass 2 (with canonical "salmon") succeeds while pass 1 (with "lachsfilet") fails.
const UNKNOWN_INGREDIENT = "200 g lachsfilet";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(searchFoodsCached).mockImplementation(async (q: string) => {
    if (q.includes("salmon"))
      return [{ fdcId: 173686, description: salmon.description, dataType: "SR Legacy" }];
    return [{ fdcId: 999, description: "Clif Z bar", dataType: "Branded" }];
  });
  vi.mocked(getFoodsCached).mockImplementation(async (ids: number[]) =>
    [salmon, junk].filter((f) => ids.includes(f.fdcId))
  );
});

describe("LLM canonicalization fallback in resolveIngredientMatches", () => {
  it("recovers a no-match via the canonical name (pass 2)", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(
      new Map([["lachsfilet", "salmon"]])
    );
    const r = await analyzeRecipeProfileAction({
      ingredients: [UNKNOWN_INGREDIENT],
      servings: 1,
    });
    expect(r.items[0].fdcId).toBe(173686);
  });

  it("stays a no-match when the fallback yields nothing (flag off → empty map)", async () => {
    vi.mocked(canonicalizeCached).mockResolvedValue(new Map());
    const r = await analyzeRecipeProfileAction({
      ingredients: [UNKNOWN_INGREDIENT],
      servings: 1,
    });
    expect(r.items[0].fdcId).toBeNull();
  });
});
