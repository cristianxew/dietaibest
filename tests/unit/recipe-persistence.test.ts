import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    recipe: { create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/entitlements", () => ({
  assertCanCreateRecipe: vi.fn(),
  assertCanImportRecipe: vi.fn(),
}));
vi.mock("@/lib/edamam-service", () => ({
  analyzeRecipeNutrition: vi.fn(),
}));

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  assertCanCreateRecipe,
  assertCanImportRecipe,
} from "@/lib/entitlements";
import { analyzeRecipeNutrition } from "@/lib/edamam-service";
import { persistRecipe } from "@/actions/recipe";
import type { RecipeFormData } from "@/types/recipe";

const baseUser = { id: "user-1", email: "u@dietai.test" };

const baseData = (overrides: Partial<RecipeFormData> = {}): RecipeFormData => ({
  title: "Test Recipe",
  servings: 2,
  ingredients: [{ name: "flour", amount: 2, unit: "cups" }],
  instructions: ["mix", "bake"],
  tags: [],
  categoryIds: [],
  isPublic: false,
  ...overrides,
});

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: baseUser.email },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as any);
  vi.mocked(prisma.recipe.create).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) =>
      Promise.resolve({
        id: "recipe-1",
        ...args.data,
        ingredients: args.data.ingredients ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
  );
  vi.mocked(prisma.recipe.update).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => Promise.resolve({ id: args.where.id }) as any
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(analyzeRecipeNutrition).mockResolvedValue(successfulNutrition as any);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lastCreateArgs = (): any =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.recipe.create).mock.calls.at(-1)![0] as any;

describe("persistRecipe — entitlement gating by source", () => {
  it("source 'manual' runs only the create gate", async () => {
    await persistRecipe(baseData(), { source: "manual" });
    expect(assertCanCreateRecipe).toHaveBeenCalledOnce();
    expect(assertCanImportRecipe).not.toHaveBeenCalled();
  });

  it("source 'generated' runs only the create gate", async () => {
    await persistRecipe(baseData(), { source: "generated" });
    expect(assertCanCreateRecipe).toHaveBeenCalledOnce();
    expect(assertCanImportRecipe).not.toHaveBeenCalled();
  });

  it("source 'url' runs the import gate AND the create gate", async () => {
    await persistRecipe(baseData(), { source: "url" });
    expect(assertCanImportRecipe).toHaveBeenCalledOnce();
    expect(assertCanCreateRecipe).toHaveBeenCalledOnce();
  });

  it("source 'imported' runs the import gate AND the create gate", async () => {
    await persistRecipe(baseData(), { source: "imported" });
    expect(assertCanImportRecipe).toHaveBeenCalledOnce();
    expect(assertCanCreateRecipe).toHaveBeenCalledOnce();
  });

  it("defaults to source 'manual' when options omitted", async () => {
    await persistRecipe(baseData());
    expect(assertCanCreateRecipe).toHaveBeenCalledOnce();
    expect(assertCanImportRecipe).not.toHaveBeenCalled();
    expect(lastCreateArgs().data.source).toBe("manual");
  });
});

describe("persistRecipe — tag injection", () => {
  it("does not add 'imported' tag for manual recipes", async () => {
    await persistRecipe(baseData({ tags: ["dinner"] }), { source: "manual" });
    expect(lastCreateArgs().data.tags).toEqual(["dinner"]);
  });

  it("does not add 'imported' tag for generated recipes", async () => {
    await persistRecipe(baseData({ tags: ["ai"] }), { source: "generated" });
    expect(lastCreateArgs().data.tags).toEqual(["ai"]);
  });

  it("adds 'imported' tag for source 'url'", async () => {
    await persistRecipe(baseData(), { source: "url" });
    expect(lastCreateArgs().data.tags).toContain("imported");
  });

  it("adds 'imported' tag for source 'imported'", async () => {
    await persistRecipe(baseData(), { source: "imported" });
    expect(lastCreateArgs().data.tags).toContain("imported");
  });

  it("adds 'imported-from-X' tag when importedFrom provided", async () => {
    await persistRecipe(baseData(), {
      source: "url",
      importedFrom: "browser-use",
    });
    const tags: string[] = lastCreateArgs().data.tags;
    expect(tags).toContain("imported");
    expect(tags).toContain("imported-from-browser-use");
  });

  it("does not duplicate the 'imported' tag if already present", async () => {
    await persistRecipe(baseData({ tags: ["imported", "dinner"] }), {
      source: "url",
    });
    const tags: string[] = lastCreateArgs().data.tags;
    expect(tags.filter((t) => t === "imported")).toHaveLength(1);
    expect(tags).toContain("dinner");
  });
});

describe("persistRecipe — source and sourceUrl persistence", () => {
  it("writes the configured source to the recipe row", async () => {
    await persistRecipe(baseData(), { source: "url" });
    expect(lastCreateArgs().data.source).toBe("url");
  });

  it("persists options.sourceUrl on the recipe row", async () => {
    await persistRecipe(baseData(), {
      source: "url",
      sourceUrl: "https://example.com/recipe-1",
    });
    expect(lastCreateArgs().data.sourceUrl).toBe(
      "https://example.com/recipe-1"
    );
  });

  it("falls back to data.sourceUrl when options.sourceUrl is not provided", async () => {
    await persistRecipe(
      baseData({ sourceUrl: "https://example.com/from-form" }),
      { source: "url" }
    );
    expect(lastCreateArgs().data.sourceUrl).toBe(
      "https://example.com/from-form"
    );
  });

  it("connects categoryIds when provided", async () => {
    await persistRecipe(baseData({ categoryIds: ["cat-1", "cat-2"] }), {
      source: "manual",
    });
    expect(lastCreateArgs().data.categories).toEqual({
      connect: [{ id: "cat-1" }, { id: "cat-2" }],
    });
  });

  it("attaches the authenticated userId to the row", async () => {
    await persistRecipe(baseData(), { source: "manual" });
    expect(lastCreateArgs().data.userId).toBe(baseUser.id);
  });
});

describe("persistRecipe — nutrition orchestration", () => {
  it("does NOT analyze nutrition for manual recipes by default", async () => {
    await persistRecipe(baseData(), { source: "manual" });
    expect(analyzeRecipeNutrition).not.toHaveBeenCalled();
    expect(prisma.recipe.update).not.toHaveBeenCalled();
  });

  it("does NOT analyze nutrition for generated recipes by default", async () => {
    await persistRecipe(baseData(), { source: "generated" });
    expect(analyzeRecipeNutrition).not.toHaveBeenCalled();
  });

  it("DOES analyze nutrition for url recipes by default", async () => {
    await persistRecipe(baseData(), { source: "url" });
    expect(analyzeRecipeNutrition).toHaveBeenCalledOnce();
  });

  it("DOES analyze nutrition for imported recipes by default", async () => {
    await persistRecipe(baseData(), { source: "imported" });
    expect(analyzeRecipeNutrition).toHaveBeenCalledOnce();
  });

  it("opt-in: manual + analyzeNutrition=true triggers analysis", async () => {
    await persistRecipe(baseData(), {
      source: "manual",
      analyzeNutrition: true,
    });
    expect(analyzeRecipeNutrition).toHaveBeenCalledOnce();
  });

  it("opt-out: url + analyzeNutrition=false skips analysis", async () => {
    await persistRecipe(baseData(), {
      source: "url",
      analyzeNutrition: false,
    });
    expect(analyzeRecipeNutrition).not.toHaveBeenCalled();
  });

  it("on success, writes macros back to the recipe row", async () => {
    await persistRecipe(baseData(), { source: "url" });
    expect(prisma.recipe.update).toHaveBeenCalledOnce();
    const updateArgs = vi.mocked(prisma.recipe.update).mock.calls[0][0] as unknown as {
      data: Record<string, number>;
    };
    expect(updateArgs.data).toMatchObject({
      calories: 100,
      protein: 5,
      carbs: 10,
      fat: 3,
    });
  });

  it("nutrition thrown error does not fail the action", async () => {
    vi.mocked(analyzeRecipeNutrition).mockRejectedValueOnce(
      new Error("API down")
    );
    const result = await persistRecipe(baseData(), { source: "url" });
    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
  });

  it("nutrition error-shape response does not fail the action", async () => {
    vi.mocked(analyzeRecipeNutrition).mockResolvedValueOnce({
      error: "rate limit",
      code: "RATE_LIMIT",
      retryable: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const result = await persistRecipe(baseData(), { source: "url" });
    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(prisma.recipe.update).not.toHaveBeenCalled();
  });

  it("forwards locale to analyzeRecipeNutrition when provided", async () => {
    await persistRecipe(baseData(), { source: "url", locale: "es" });
    const args = vi.mocked(analyzeRecipeNutrition).mock.calls[0];
    expect(args[2]).toMatchObject({ locale: "es" });
  });
});

describe("persistRecipe — passes structured ingredients through the formatter", () => {
  it("normalizes structured ingredients into 'amount unit name' lines", async () => {
    await persistRecipe(
      baseData({
        ingredients: [
          { name: "flour", amount: 2, unit: "cups" },
          { name: "salt", amount: 1, unit: "tsp" },
        ],
      }),
      { source: "url" }
    );
    const args = vi.mocked(analyzeRecipeNutrition).mock.calls[0];
    expect(args[0].ingredients).toEqual(["2 cups flour", "1 tsp salt"]);
  });
});
