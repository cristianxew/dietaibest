/**
 * Integration Tests for Nutrition Analysis Workflow
 * Tests the complete analyzeRecipeAction workflow with mocked FDC API responses
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { analyzeRecipeAction } from "@/actions/analyzeRecipe";
import type { FdcSearchResult, FdcFood } from "@/lib/fdc";

// Mock the FDC module
vi.mock("@/lib/fdc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/fdc")>("@/lib/fdc");
  return {
    ...actual,
    fdcSearch: vi.fn(),
    fdcFoodsByIds: vi.fn(),
  };
});

// Mock the fdcRepo module
vi.mock("@/lib/fdcRepo", () => ({
  getFoodsCached: vi.fn(),
}));

// Import mocked functions
import { fdcSearch } from "@/lib/fdc";
import { getFoodsCached } from "@/lib/fdcRepo";

describe("Nutrition Analysis Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("analyzes a simple recipe with one ingredient", async () => {
    // Mock FDC search response
    const mockSearchResult: FdcSearchResult = {
      foods: [
        {
          fdcId: 171705,
          description: "Chicken, broilers or fryers, breast, meat only, raw",
          dataType: "Foundation",
        },
      ],
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
    };

    // Mock FDC food detail response
    const mockFoodDetail: FdcFood = {
      fdcId: 171705,
      description: "Chicken, broilers or fryers, breast, meat only, raw",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 165 }, // kcal
        { nutrientNumber: "203", amount: 31 }, // protein
        { nutrientNumber: "204", amount: 3.6 }, // fat
        { nutrientNumber: "205", amount: 0 }, // carbs
        { nutrientNumber: "291", amount: 0 }, // fiber
      ],
      foodPortions: [],
    };

    vi.mocked(fdcSearch).mockResolvedValue(mockSearchResult);
    vi.mocked(getFoodsCached).mockResolvedValue([mockFoodDetail]);

    const result = await analyzeRecipeAction({
      ingredients: ["100 g chicken breast"],
      servings: 1,
    });

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.fdcId).toBe(171705);
    expect(item.gramsTotal).toBe(100);
    expect(item.macros.kcal).toBe(165);
    expect(item.macros.protein).toBe(31);

    // Check totals
    expect(result.total.kcal).toBe(165);
    expect(result.total.protein).toBe(31);

    // Check per serving (same as total for 1 serving)
    expect(result.perServing.kcal).toBe(165);
    expect(result.perServing.protein).toBe(31);
  });

  it("analyzes a recipe with multiple ingredients", async () => {
    // Mock search results for multiple ingredients
    const mockChickenSearch: FdcSearchResult = {
      foods: [
        {
          fdcId: 171705,
          description: "Chicken breast, raw",
          dataType: "Foundation",
        },
      ],
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
    };

    const mockRiceSearch: FdcSearchResult = {
      foods: [
        {
          fdcId: 168880,
          description: "Rice, white, cooked",
          dataType: "SR Legacy",
        },
      ],
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
    };

    const mockOilSearch: FdcSearchResult = {
      foods: [
        {
          fdcId: 171413,
          description: "Oil, olive",
          dataType: "Foundation",
        },
      ],
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
    };

    // Mock food details
    const mockChicken: FdcFood = {
      fdcId: 171705,
      description: "Chicken breast, raw",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 165 },
        { nutrientNumber: "203", amount: 31 },
        { nutrientNumber: "204", amount: 3.6 },
        { nutrientNumber: "205", amount: 0 },
        { nutrientNumber: "291", amount: 0 },
      ],
      foodPortions: [],
    };

    const mockRice: FdcFood = {
      fdcId: 168880,
      description: "Rice, white, cooked",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientNumber: "208", amount: 130 },
        { nutrientNumber: "203", amount: 2.7 },
        { nutrientNumber: "204", amount: 0.3 },
        { nutrientNumber: "205", amount: 28 },
        { nutrientNumber: "291", amount: 0.4 },
      ],
      foodPortions: [{ portionDescription: "cup", gramWeight: 158 }],
    };

    const mockOil: FdcFood = {
      fdcId: 171413,
      description: "Oil, olive",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 884 },
        { nutrientNumber: "203", amount: 0 },
        { nutrientNumber: "204", amount: 100 },
        { nutrientNumber: "205", amount: 0 },
        { nutrientNumber: "291", amount: 0 },
      ],
      foodPortions: [{ portionDescription: "tablespoon", gramWeight: 13.5 }],
    };

    // Setup mocks to return different results based on search query
    vi.mocked(fdcSearch)
      .mockResolvedValueOnce(mockChickenSearch)
      .mockResolvedValueOnce(mockRiceSearch)
      .mockResolvedValueOnce(mockOilSearch);

    vi.mocked(getFoodsCached).mockResolvedValue([
      mockChicken,
      mockRice,
      mockOil,
    ]);

    const result = await analyzeRecipeAction({
      ingredients: [
        "200 g chicken breast",
        "1 cup white rice",
        "1 tbsp olive oil",
      ],
      servings: 2,
    });

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(3);

    // Verify chicken (200g = 2x per 100g)
    const chicken = result.items[0];
    expect(chicken.gramsTotal).toBe(200);
    expect(chicken.macros.kcal).toBeCloseTo(330, 0); // 165 * 2

    // Verify rice (1 cup = 158g)
    const rice = result.items[1];
    expect(rice.gramsTotal).toBeCloseTo(158, 0);
    expect(rice.macros.kcal).toBeCloseTo(205.4, 0); // 130 * 1.58

    // Verify olive oil (1 tbsp = 13.5g)
    const oil = result.items[2];
    expect(oil.gramsTotal).toBeCloseTo(13.5, 0);
    expect(oil.macros.kcal).toBeCloseTo(119.3, 0); // 884 * 0.135

    // Check total calories (approximately)
    const totalCalories = result.total.kcal;
    expect(totalCalories).toBeGreaterThan(600);
    expect(totalCalories).toBeLessThan(700);

    // Check per serving (total / 2)
    expect(result.perServing.kcal).toBeCloseTo(totalCalories / 2, 0);
  });

  it("handles ingredient not found in FDC", async () => {
    // Mock empty search result
    const mockEmptySearch: FdcSearchResult = {
      foods: [],
      totalHits: 0,
      currentPage: 1,
      totalPages: 0,
    };

    vi.mocked(fdcSearch).mockResolvedValue(mockEmptySearch);
    vi.mocked(getFoodsCached).mockResolvedValue([]); // Return empty array

    const result = await analyzeRecipeAction({
      ingredients: ["100 g magical unicorn meat"],
      servings: 1,
    });

    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(1);

    const item = result.items[0];
    expect(item.fdcId).toBeNull();
    expect(item.confidence).toBe(0);
    expect(item.macros.kcal).toBe(0);
  });

  it("calculates per-serving macros correctly", async () => {
    const mockSearch: FdcSearchResult = {
      foods: [
        {
          fdcId: 171705,
          description: "Chicken breast",
          dataType: "Foundation",
        },
      ],
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
    };

    const mockFood: FdcFood = {
      fdcId: 171705,
      description: "Chicken breast",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 165 },
        { nutrientNumber: "203", amount: 31 },
        { nutrientNumber: "204", amount: 3.6 },
        { nutrientNumber: "205", amount: 0 },
        { nutrientNumber: "291", amount: 0 },
      ],
      foodPortions: [],
    };

    vi.mocked(fdcSearch).mockResolvedValue(mockSearch);
    vi.mocked(getFoodsCached).mockResolvedValue([mockFood]);

    // 400g chicken for 4 servings = 100g per serving
    const result = await analyzeRecipeAction({
      ingredients: ["400 g chicken breast"],
      servings: 4,
    });

    expect(result.success).toBe(true);

    // Total should be 4x per-100g values
    expect(result.total.kcal).toBeCloseTo(660, 0); // 165 * 4
    expect(result.total.protein).toBeCloseTo(124, 0); // 31 * 4

    // Per serving should be 1/4 of total
    expect(result.perServing.kcal).toBeCloseTo(165, 0);
    expect(result.perServing.protein).toBeCloseTo(31, 0);
  });

  it("uses density fallback when FDC portions not available", async () => {
    const mockSearch: FdcSearchResult = {
      foods: [
        {
          fdcId: 11282,
          description: "Onions, raw",
          dataType: "Foundation",
        },
      ],
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
    };

    const mockFood: FdcFood = {
      fdcId: 11282,
      description: "Onions, raw",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 40 },
        { nutrientNumber: "203", amount: 1.1 },
        { nutrientNumber: "204", amount: 0.1 },
        { nutrientNumber: "205", amount: 9.3 },
        { nutrientNumber: "291", amount: 1.7 },
      ],
      foodPortions: [], // No portions available
    };

    vi.mocked(fdcSearch).mockResolvedValue(mockSearch);
    vi.mocked(getFoodsCached).mockResolvedValue([mockFood]);

    const result = await analyzeRecipeAction({
      ingredients: ["1 cup chopped onion"],
      servings: 1,
    });

    expect(result.success).toBe(true);
    const item = result.items[0];

    // Should use density fallback (likely ~160g per cup for onions)
    expect(item.gramsTotal).toBeGreaterThan(0);
    expect(item.confidence).toBeLessThan(1.0); // Lower confidence for fallback
    expect(item.portionNote).toContain("fallback");
  });

  it("prioritizes Foundation over other data types", async () => {
    const mockSearch: FdcSearchResult = {
      foods: [
        {
          fdcId: 2,
          description: "Chicken breast - Branded",
          dataType: "Branded",
        },
        {
          fdcId: 3,
          description: "Chicken breast - SR Legacy",
          dataType: "SR Legacy",
        },
        {
          fdcId: 1,
          description: "Chicken breast - Foundation",
          dataType: "Foundation",
        },
      ],
      totalHits: 3,
      currentPage: 1,
      totalPages: 1,
    };

    const mockFoundation: FdcFood = {
      fdcId: 1,
      description: "Chicken breast - Foundation",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 165 },
        { nutrientNumber: "203", amount: 31 },
        { nutrientNumber: "204", amount: 3.6 },
        { nutrientNumber: "205", amount: 0 },
        { nutrientNumber: "291", amount: 0 },
      ],
      foodPortions: [],
    };

    vi.mocked(fdcSearch).mockResolvedValue(mockSearch);
    vi.mocked(getFoodsCached).mockResolvedValue([mockFoundation]);

    const result = await analyzeRecipeAction({
      ingredients: ["100 g chicken breast"],
      servings: 1,
    });

    expect(result.success).toBe(true);

    // Should have selected Foundation type (fdcId: 1)
    const item = result.items[0];
    expect(item.fdcId).toBe(1);
    expect(item.description).toContain("Foundation");
  });

  it("handles empty ingredient list", async () => {
    const result = await analyzeRecipeAction({
      ingredients: [],
      servings: 1,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("handles invalid servings count", async () => {
    const result = await analyzeRecipeAction({
      ingredients: ["100 g chicken"],
      servings: 0,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("aggregates macros correctly across multiple ingredients", async () => {
    const mockSearches = [
      {
        foods: [{ fdcId: 1, description: "Protein", dataType: "Foundation" }],
        totalHits: 1,
        currentPage: 1,
        totalPages: 1,
      } as FdcSearchResult,
      {
        foods: [{ fdcId: 2, description: "Carbs", dataType: "Foundation" }],
        totalHits: 1,
        currentPage: 1,
        totalPages: 1,
      } as FdcSearchResult,
    ];

    const mockFoods: FdcFood[] = [
      {
        fdcId: 1,
        description: "Protein",
        dataType: "Foundation",
        foodNutrients: [
          { nutrientNumber: "208", amount: 100 },
          { nutrientNumber: "203", amount: 25 }, // High protein
          { nutrientNumber: "204", amount: 2 },
          { nutrientNumber: "205", amount: 0 },
          { nutrientNumber: "291", amount: 0 },
        ],
        foodPortions: [],
      },
      {
        fdcId: 2,
        description: "Carbs",
        dataType: "Foundation",
        foodNutrients: [
          { nutrientNumber: "208", amount: 100 },
          { nutrientNumber: "203", amount: 2 },
          { nutrientNumber: "204", amount: 1 },
          { nutrientNumber: "205", amount: 22 }, // High carbs
          { nutrientNumber: "291", amount: 3 },
        ],
        foodPortions: [],
      },
    ];

    vi.mocked(fdcSearch)
      .mockResolvedValueOnce(mockSearches[0])
      .mockResolvedValueOnce(mockSearches[1]);
    vi.mocked(getFoodsCached).mockResolvedValue(mockFoods);

    const result = await analyzeRecipeAction({
      ingredients: ["100 g protein source", "100 g carb source"],
      servings: 1,
    });

    expect(result.success).toBe(true);

    // Total protein should be 25 + 2 = 27g
    expect(result.total.protein).toBeCloseTo(27, 0);

    // Total carbs should be 0 + 22 = 22g
    expect(result.total.carbs).toBeCloseTo(22, 0);

    // Total calories should be 100 + 100 = 200 kcal
    expect(result.total.kcal).toBeCloseTo(200, 0);
  });

  it("provides confidence scores for each ingredient", async () => {
    const mockSearch: FdcSearchResult = {
      foods: [{ fdcId: 1, description: "Test food", dataType: "Foundation" }],
      totalHits: 1,
      currentPage: 1,
      totalPages: 1,
    };

    const mockFood: FdcFood = {
      fdcId: 1,
      description: "Test food",
      dataType: "Foundation",
      foodNutrients: [
        { nutrientNumber: "208", amount: 100 },
        { nutrientNumber: "203", amount: 10 },
        { nutrientNumber: "204", amount: 5 },
        { nutrientNumber: "205", amount: 15 },
        { nutrientNumber: "291", amount: 2 },
      ],
      foodPortions: [],
    };

    vi.mocked(fdcSearch).mockResolvedValue(mockSearch);
    vi.mocked(getFoodsCached).mockResolvedValue([mockFood]);

    const result = await analyzeRecipeAction({
      ingredients: ["100 g test food"],
      servings: 1,
    });

    expect(result.success).toBe(true);

    const item = result.items[0];
    expect(item.confidence).toBeGreaterThan(0);
    expect(item.confidence).toBeLessThanOrEqual(1);
    expect(typeof item.confidence).toBe("number");
  });
});
