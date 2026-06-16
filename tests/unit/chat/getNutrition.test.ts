import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/recipe", () => ({
  getRecipe: vi.fn(),
  saveRecipeNutritionProfile: vi.fn(),
}));
vi.mock("@/actions/analyzeRecipe", () => ({
  analyzeRecipeProfileAction: vi.fn(),
}));
vi.mock("@/lib/ingredients", () => ({
  formatIngredientsForNutrition: vi.fn(() => ["formatted line"]),
}));

import { getRecipe, saveRecipeNutritionProfile } from "@/actions/recipe";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";
import { getNutrition } from "@/lib/chat/tools/getNutrition";
import type { AgentContext } from "@/lib/chat/context";

const ctx = {} as AgentContext;

// A complete per-serving FDC profile (22 fields, `Profile` shape: `calories`).
const PROFILE = {
  calories: 250,
  protein: 10,
  carbs: 30,
  fat: 8,
  fiber: 4,
  sugar: 5,
  sodium: 100,
  cholesterol: 20,
  saturatedFat: 2.4,
  transFat: 0,
  vitaminA: 1,
  vitaminC: 2,
  vitaminD: 3,
  vitaminE: 4,
  vitaminK: 5,
  vitaminB12: 6,
  folate: 7,
  iron: 8,
  calcium: 9,
  magnesium: 10,
  potassium: 11,
  zinc: 1.2,
};

// A persisted Recipe row carries per-serving nutrition under DB column names
// (`calories`, `carbs`, ...). Micros may be null on legacy rows.
function storedRecipe(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    servings: 2,
    viewerIsOwner: true,
    ingredients: [{ name: "rice", amount: 1, unit: "cup" }],
    ...PROFILE,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getNutrition — stored recipe profile", () => {
  it("returns the persisted per-serving values without re-analyzing (chat == detail page)", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: storedRecipe(),
      error: null,
    } as never);

    const res = await getNutrition.execute({ recipeId: "r1", servings: 1 }, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.source).toBe("stored");
    expect(res.data.servings).toBe(2);
    // per-serving == persisted columns
    expect(res.data.perServing.kcal).toBe(250);
    expect(res.data.perServing.protein).toBe(10);
    expect(res.data.perServing.carbs).toBe(30);
    expect(res.data.perServing.fat).toBe(8);
    expect(res.data.perServing.fiber).toBe(4);
    // total == per-serving * servings
    expect(res.data.total.kcal).toBe(500);
    expect(res.data.total.protein).toBe(20);
    // zero-cost: never hits FDC and never re-persists (already stored)
    expect(analyzeRecipeProfileAction).not.toHaveBeenCalled();
    expect(saveRecipeNutritionProfile).not.toHaveBeenCalled();
  });

  it("includes the micronutrient breakdown from the persisted profile", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: storedRecipe(),
      error: null,
    } as never);

    const res = await getNutrition.execute({ recipeId: "r1", servings: 1 }, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.micros.calcium).toBe(9);
    expect(res.data.micros.iron).toBe(8);
    expect(res.data.micros.sodium).toBe(100);
    expect(res.data.micros.vitaminD).toBe(3);
    expect(res.data.micros.zinc).toBe(1.2);
  });

  it("grounds both macros and micros (rounded, finite, non-negative)", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: storedRecipe(),
      error: null,
    } as never);

    const res = await getNutrition.execute({ recipeId: "r1", servings: 1 }, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const grounded = new Set(res.data.groundedValues);
    // macros (per-serving + total)
    expect(grounded.has(250)).toBe(true);
    expect(grounded.has(500)).toBe(true);
    // micros rounded to integers
    expect(grounded.has(9)).toBe(true); // calcium
    expect(grounded.has(2)).toBe(true); // saturatedFat 2.4 -> 2
    expect(grounded.has(1)).toBe(true); // zinc 1.2 -> 1
    // no NaN / negatives
    expect(res.data.groundedValues.every((n) => Number.isFinite(n) && n >= 0)).toBe(true);
  });

  it("represents legacy null micros as null and keeps them out of grounded values", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: storedRecipe({ vitaminD: null, calcium: null }),
      error: null,
    } as never);

    const res = await getNutrition.execute({ recipeId: "r1", servings: 1 }, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.micros.vitaminD).toBeNull();
    expect(res.data.micros.calcium).toBeNull();
    expect(res.data.groundedValues.every((n) => n !== null)).toBe(true);
  });
});

describe("getNutrition — fresh FDC analysis", () => {
  it("analyzes an un-analyzed recipe (no stored calories) via FDC", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: storedRecipe({ calories: null }),
      error: null,
    } as never);
    vi.mocked(analyzeRecipeProfileAction).mockResolvedValue({
      success: true,
      total: { ...PROFILE, calories: 500 },
      perServing: PROFILE,
      items: [],
    } as never);

    const res = await getNutrition.execute({ recipeId: "r1", servings: 1 }, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.source).toBe("fdc");
    expect(analyzeRecipeProfileAction).toHaveBeenCalledWith({
      ingredients: ["formatted line"],
      servings: 2,
    });
    expect(res.data.perServing.kcal).toBe(250);
    expect(res.data.micros.iron).toBe(8);
    // backfills the full profile (macros + micros) onto the owner's recipe so
    // the detail page shows the same numbers next time
    expect(saveRecipeNutritionProfile).toHaveBeenCalledWith("r1", PROFILE);
  });

  it("does NOT backfill a recipe the user does not own", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: storedRecipe({ calories: null, viewerIsOwner: false }),
      error: null,
    } as never);
    vi.mocked(analyzeRecipeProfileAction).mockResolvedValue({
      success: true,
      total: { ...PROFILE, calories: 500 },
      perServing: PROFILE,
      items: [],
    } as never);

    const res = await getNutrition.execute({ recipeId: "r1", servings: 1 }, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.source).toBe("fdc");
    expect(saveRecipeNutritionProfile).not.toHaveBeenCalled();
  });

  it("still returns the analysis when the backfill write fails", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: storedRecipe({ calories: null }),
      error: null,
    } as never);
    vi.mocked(analyzeRecipeProfileAction).mockResolvedValue({
      success: true,
      total: { ...PROFILE, calories: 500 },
      perServing: PROFILE,
      items: [],
    } as never);
    vi.mocked(saveRecipeNutritionProfile).mockResolvedValue({
      data: null,
      error: "db down",
    } as never);

    const res = await getNutrition.execute({ recipeId: "r1", servings: 1 }, ctx);

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.perServing.kcal).toBe(250);
  });

  it("analyzes an ad-hoc ingredient list via FDC", async () => {
    vi.mocked(analyzeRecipeProfileAction).mockResolvedValue({
      success: true,
      total: { ...PROFILE, calories: 500 },
      perServing: PROFILE,
      items: [],
    } as never);

    const res = await getNutrition.execute(
      { ingredients: ["1 cup rice", "2 eggs"], servings: 2 },
      ctx
    );

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.source).toBe("fdc");
    expect(getRecipe).not.toHaveBeenCalled();
    expect(analyzeRecipeProfileAction).toHaveBeenCalledWith({
      ingredients: ["1 cup rice", "2 eggs"],
      servings: 2,
    });
    expect(res.data.micros.potassium).toBe(11);
    // an ad-hoc list is not tied to a recipe — nothing to persist
    expect(saveRecipeNutritionProfile).not.toHaveBeenCalled();
  });

  it("fails cleanly when fresh analysis fails", async () => {
    vi.mocked(analyzeRecipeProfileAction).mockResolvedValue({
      success: false,
      error: "boom",
      total: {} as never,
      perServing: {} as never,
      items: [],
    } as never);

    const res = await getNutrition.execute(
      { ingredients: ["1 cup rice"], servings: 1 },
      ctx
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("generic");
  });

  it("fails cleanly when the recipe is not found", async () => {
    vi.mocked(getRecipe).mockResolvedValue({
      data: null,
      error: "Recipe not found",
    } as never);

    const res = await getNutrition.execute({ recipeId: "missing", servings: 1 }, ctx);

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("notFound");
  });
});
