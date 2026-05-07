import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    recipe: { update: vi.fn() },
  },
}));
vi.mock("@/lib/edamam-service", () => ({
  analyzeRecipeNutrition: vi.fn(),
  saveUserMacroCache: vi.fn(),
}));

import prisma from "@/lib/prisma";
import {
  analyzeRecipeNutrition,
  saveUserMacroCache,
} from "@/lib/edamam-service";
import { applyNutritionToRecipe } from "@/lib/recipe-nutrition";
import type { Recipe } from "@/generated/prisma";

const baseRecipe = (overrides: Partial<Recipe> = {}): Recipe =>
  ({
    id: "recipe-1",
    title: "Test Recipe",
    servings: 2,
    sourceUrl: null,
    instructions: ["mix"],
    ingredients: [{ name: "flour", amount: 2, unit: "cups" }],
    ...overrides,
  } as unknown as Recipe);

const successfulNutrition = {
  macros: { calories: 100, protein: 5, fat: 3, netCarbs: 10 },
  dietLabels: [],
  healthLabels: [],
  cautions: [],
  servings: 2,
  fromCache: false,
  fingerprint: "abc",
  analyzedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.recipe.update).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => Promise.resolve({ id: args.where.id }) as any,
  );
  vi.mocked(analyzeRecipeNutrition).mockResolvedValue(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    successfulNutrition as any,
  );
  vi.mocked(saveUserMacroCache).mockResolvedValue(undefined);
});

describe("applyNutritionToRecipe — applied outcome", () => {
  it("returns kind 'applied' with macros + nutrition on success", async () => {
    const result = await applyNutritionToRecipe(baseRecipe(), "user-1");
    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.macros).toMatchObject({
        calories: 100,
        protein: 5,
        fat: 3,
        netCarbs: 10,
      });
      expect(result.nutrition).toBe(successfulNutrition);
    }
  });

  it("returns the updated recipe row in the applied outcome", async () => {
    const result = await applyNutritionToRecipe(baseRecipe(), "user-1");
    expect(result.kind).toBe("applied");
    if (result.kind === "applied") {
      expect(result.recipe).toMatchObject({ id: "recipe-1" });
    }
  });

  it("writes macros back to the recipe row", async () => {
    await applyNutritionToRecipe(baseRecipe(), "user-1");
    expect(prisma.recipe.update).toHaveBeenCalledOnce();
    const updateArgs = vi.mocked(prisma.recipe.update).mock.calls[0][0] as {
      where: { id: string };
      data: Record<string, number>;
    };
    expect(updateArgs.where.id).toBe("recipe-1");
    expect(updateArgs.data).toMatchObject({
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 3,
    });
  });

  it("saves the user macro cache with userId, recipeId, macros, servings", async () => {
    await applyNutritionToRecipe(baseRecipe({ servings: 4 }), "user-1");
    expect(saveUserMacroCache).toHaveBeenCalledOnce();
    expect(saveUserMacroCache).toHaveBeenCalledWith(
      "user-1",
      "recipe-1",
      successfulNutrition.macros,
      successfulNutrition.servings,
    );
  });

  it("forwards locale to analyzeRecipeNutrition", async () => {
    await applyNutritionToRecipe(baseRecipe(), "user-1", { locale: "es" });
    const args = vi.mocked(analyzeRecipeNutrition).mock.calls[0];
    expect(args[2]).toMatchObject({ locale: "es" });
  });

  it("forwards forceRefresh to analyzeRecipeNutrition", async () => {
    await applyNutritionToRecipe(baseRecipe(), "user-1", {
      forceRefresh: true,
    });
    const args = vi.mocked(analyzeRecipeNutrition).mock.calls[0];
    expect(args[2]).toMatchObject({ forceRefresh: true });
  });

  it("normalizes structured ingredients into 'amount unit name' lines", async () => {
    await applyNutritionToRecipe(
      baseRecipe({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ingredients: [
          { name: "flour", amount: 2, unit: "cups" },
          { name: "salt", amount: 1, unit: "tsp" },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      }),
      "user-1",
    );
    const args = vi.mocked(analyzeRecipeNutrition).mock.calls[0];
    expect(args[0].ingredients).toEqual(["2 cups flour", "1 tsp salt"]);
  });
});

describe("applyNutritionToRecipe — noop outcome", () => {
  it("returns kind 'noop' with reason 'no-ingredients' when ingredients are empty", async () => {
    const result = await applyNutritionToRecipe(
      baseRecipe({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ingredients: [] as any,
      }),
      "user-1",
    );
    expect(result.kind).toBe("noop");
    if (result.kind === "noop") {
      expect(result.reason).toBe("no-ingredients");
    }
  });

  it("does not call analyzeRecipeNutrition for noop", async () => {
    await applyNutritionToRecipe(
      baseRecipe({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ingredients: [] as any,
      }),
      "user-1",
    );
    expect(analyzeRecipeNutrition).not.toHaveBeenCalled();
    expect(prisma.recipe.update).not.toHaveBeenCalled();
    expect(saveUserMacroCache).not.toHaveBeenCalled();
  });
});

describe("applyNutritionToRecipe — failed outcome", () => {
  it("returns kind 'failed' when analyzeRecipeNutrition returns an error shape", async () => {
    vi.mocked(analyzeRecipeNutrition).mockResolvedValueOnce({
      error: "rate limit",
      code: "RATE_LIMIT",
      retryable: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await applyNutritionToRecipe(baseRecipe(), "user-1");
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.reason).toBe("rate limit");
    }
  });

  it("does not update the recipe row on failure", async () => {
    vi.mocked(analyzeRecipeNutrition).mockResolvedValueOnce({
      error: "boom",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await applyNutritionToRecipe(baseRecipe(), "user-1");
    expect(prisma.recipe.update).not.toHaveBeenCalled();
    expect(saveUserMacroCache).not.toHaveBeenCalled();
  });

  it("returns kind 'failed' when analyzeRecipeNutrition throws", async () => {
    vi.mocked(analyzeRecipeNutrition).mockRejectedValueOnce(
      new Error("API down"),
    );
    const result = await applyNutritionToRecipe(baseRecipe(), "user-1");
    expect(result.kind).toBe("failed");
    if (result.kind === "failed") {
      expect(result.reason).toContain("API down");
    }
    expect(prisma.recipe.update).not.toHaveBeenCalled();
    expect(saveUserMacroCache).not.toHaveBeenCalled();
  });
});

describe("applyNutritionToRecipe — RecipeNutritionInput shape", () => {
  it("passes title, servings, instructions, and sourceUrl to the analyzer", async () => {
    await applyNutritionToRecipe(
      baseRecipe({
        title: "Bolognese",
        servings: 6,
        instructions: ["chop", "simmer"],
        sourceUrl: "https://example.com/r",
      }),
      "user-1",
    );
    const args = vi.mocked(analyzeRecipeNutrition).mock.calls[0];
    expect(args[0]).toMatchObject({
      title: "Bolognese",
      servings: 6,
      instructions: ["chop", "simmer"],
      url: "https://example.com/r",
    });
  });

  it("omits url when sourceUrl is null", async () => {
    await applyNutritionToRecipe(baseRecipe({ sourceUrl: null }), "user-1");
    const args = vi.mocked(analyzeRecipeNutrition).mock.calls[0];
    expect(args[0].url).toBeUndefined();
  });
});
