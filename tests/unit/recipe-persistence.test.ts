import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    recipe: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    recipeIngredient: { deleteMany: vi.fn(), createMany: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/entitlements", () => ({
  assertCanCreateRecipe: vi.fn(),
  assertCanImportRecipe: vi.fn(),
}));
vi.mock("@/actions/analyzeRecipe", () => ({
  analyzeRecipeProfileAction: vi.fn(),
}));

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  assertCanCreateRecipe,
  assertCanImportRecipe,
} from "@/lib/entitlements";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";
import { persistRecipe, updateRecipe } from "@/actions/recipe";
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

// Full 22-field profile the FDC engine returns per serving.
const FULL_PROFILE = {
  calories: 100,
  protein: 5,
  carbs: 12,
  fat: 3,
  fiber: 2,
  sugar: 1,
  sodium: 50,
  cholesterol: 10,
  saturatedFat: 0.5,
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
  zinc: 12,
};

const profileResult = {
  success: true,
  total: FULL_PROFILE,
  perServing: FULL_PROFILE,
  items: [
    {
      original: "2 cups flour",
      name: "flour",
      nameNorm: "flour",
      qty: 2,
      unit: "cup",
      fdcId: 123,
      description: "Flour, all-purpose",
      gramsTotal: 480,
      confidence: 0.9,
      portionNote: "USDA portion",
      dataType: "SR Legacy",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
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
        servings: args.data.servings ?? 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any
  );
  vi.mocked(prisma.recipe.update).mockImplementation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => Promise.resolve({ id: args.where.id }) as any
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.recipeIngredient.deleteMany).mockResolvedValue({ count: 0 } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.recipeIngredient.createMany).mockResolvedValue({ count: 1 } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(analyzeRecipeProfileAction).mockResolvedValue(profileResult as any);
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

describe("persistRecipe — canonicalUrl derivation", () => {
  it("writes the canonical URL for source 'url'", async () => {
    await persistRecipe(
      baseData({ sourceUrl: "https://example.com/carbonara/?utm_source=x" }),
      { source: "url", sourceUrl: "https://example.com/carbonara/?utm_source=x" }
    );
    expect(lastCreateArgs().data.canonicalUrl).toBe("https://example.com/carbonara");
  });

  it("leaves canonicalUrl null for manual recipes", async () => {
    await persistRecipe(baseData(), { source: "manual" });
    expect(lastCreateArgs().data.canonicalUrl ?? null).toBeNull();
  });

  it("leaves canonicalUrl null for image imports (storage-path sourceUrl)", async () => {
    await persistRecipe(baseData(), {
      source: "imported",
      sourceUrl: "user-1/event-1/jpg",
    });
    expect(lastCreateArgs().data.canonicalUrl ?? null).toBeNull();
  });
});

describe("persistRecipe — dedup nutrition copy path", () => {
  const rawUrl = "https://example.com/carbonara?utm_source=x";
  const canonical = "https://example.com/carbonara";

  const dedupSource = (overrides: Record<string, unknown> = {}) => ({
    id: "src-1",
    userId: "user-b",
    source: "url",
    canonicalUrl: canonical,
    servings: 2,
    ingredients: [{ name: "flour", amount: 2, unit: "cups" }],
    ...FULL_PROFILE,
    recipeIngredients: [
      {
        id: "ri-1",
        recipeId: "src-1",
        originalText: "2 cups flour",
        nameNorm: "flour",
        qty: 2,
        unit: "cup",
        fdcId: 123,
        gramWeight: 480,
        confidence: 0.9,
      },
    ],
    ...overrides,
  });

  const importOpts = {
    source: "url" as const,
    sourceUrl: rawUrl,
    dedupSourceRecipeId: "src-1",
  };

  it("copies nutrition + RecipeIngredient rows instead of re-analyzing", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(dedupSource() as any);

    await persistRecipe(baseData({ sourceUrl: rawUrl }), importOpts);

    expect(analyzeRecipeProfileAction).not.toHaveBeenCalled();
    expect(prisma.recipe.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "recipe-1" },
        data: expect.objectContaining({ calories: 100, zinc: 12 }),
      })
    );
    expect(prisma.recipeIngredient.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ recipeId: "recipe-1", fdcId: 123 }),
      ],
    });
    const createManyRow =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (vi.mocked(prisma.recipeIngredient.createMany).mock.calls[0][0] as any).data[0];
    expect(createManyRow.id).toBeUndefined();
  });

  it("falls back to analysis when the source row is missing", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(null);
    await persistRecipe(baseData({ sourceUrl: rawUrl }), importOpts);
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("falls back when the source canonicalUrl does not match (tamper guard)", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dedupSource({ canonicalUrl: "https://elsewhere.com/other" }) as any
    );
    await persistRecipe(baseData({ sourceUrl: rawUrl }), importOpts);
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("falls back when ingredients were edited in the preview", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(dedupSource() as any);
    await persistRecipe(
      baseData({
        sourceUrl: rawUrl,
        ingredients: [{ name: "sugar", amount: 1, unit: "cups" }],
      }),
      importOpts
    );
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("falls back when servings differ", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(dedupSource() as any);
    await persistRecipe(baseData({ sourceUrl: rawUrl, servings: 4 }), importOpts);
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("falls back when the source has no completed nutrition", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dedupSource({ calories: null }) as any
    );
    await persistRecipe(baseData({ sourceUrl: rawUrl }), importOpts);
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
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

describe("persistRecipe — FDC nutrition orchestration (all paths)", () => {
  it("analyzes nutrition for manual recipes by default", async () => {
    await persistRecipe(baseData(), { source: "manual" });
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("analyzes nutrition for generated recipes by default", async () => {
    await persistRecipe(baseData(), { source: "generated" });
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("analyzes nutrition for url recipes by default", async () => {
    await persistRecipe(baseData(), { source: "url" });
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("analyzes nutrition for imported recipes by default", async () => {
    await persistRecipe(baseData(), { source: "imported" });
    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("opt-out: analyzeNutrition=false skips analysis", async () => {
    await persistRecipe(baseData(), {
      source: "url",
      analyzeNutrition: false,
    });
    expect(analyzeRecipeProfileAction).not.toHaveBeenCalled();
    expect(prisma.recipe.update).not.toHaveBeenCalled();
  });

  it("on success, writes the full 22-field profile back to the recipe row", async () => {
    await persistRecipe(baseData(), { source: "manual" });
    expect(prisma.recipe.update).toHaveBeenCalledOnce();
    const updateArgs = vi.mocked(prisma.recipe.update).mock
      .calls[0][0] as unknown as { data: Record<string, number> };
    expect(updateArgs.data).toMatchObject(FULL_PROFILE);
  });

  it("persists per-ingredient RecipeIngredient rows (delete-then-insert)", async () => {
    await persistRecipe(baseData(), { source: "manual" });
    expect(prisma.recipeIngredient.deleteMany).toHaveBeenCalledWith({
      where: { recipeId: "recipe-1" },
    });
    const createArgs = vi.mocked(prisma.recipeIngredient.createMany).mock
      .calls[0][0] as unknown as { data: Array<Record<string, unknown>> };
    expect(createArgs.data).toHaveLength(1);
    expect(createArgs.data[0]).toMatchObject({
      recipeId: "recipe-1",
      originalText: "2 cups flour",
      nameNorm: "flour",
      qty: 2,
      unit: "cup",
      fdcId: 123,
      gramWeight: 480,
      confidence: 0.9,
    });
  });

  it("passes the formatted ingredient lines and servings to the FDC engine", async () => {
    await persistRecipe(
      baseData({
        servings: 2,
        ingredients: [
          { name: "flour", amount: 2, unit: "cups" },
          { name: "salt", amount: 1, unit: "tsp" },
        ],
      }),
      { source: "url" }
    );
    const args = vi.mocked(analyzeRecipeProfileAction).mock.calls[0][0];
    expect(args.ingredients).toEqual(["2 cups flour", "1 tsp salt"]);
    expect(args.servings).toBe(2);
  });

  it("nutrition thrown error does not fail the action", async () => {
    vi.mocked(analyzeRecipeProfileAction).mockRejectedValueOnce(
      new Error("FDC down")
    );
    const result = await persistRecipe(baseData(), { source: "url" });
    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
  });

  it("unsuccessful analysis does not write nutrition or ingredient rows", async () => {
    vi.mocked(analyzeRecipeProfileAction).mockResolvedValueOnce({
      success: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    const result = await persistRecipe(baseData(), { source: "url" });
    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
    expect(prisma.recipe.update).not.toHaveBeenCalled();
    expect(prisma.recipeIngredient.createMany).not.toHaveBeenCalled();
  });
});

describe("updateRecipe — recompute nutrition only on ingredient change", () => {
  const existing = (ingredients: unknown) =>
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      userId: baseUser.id,
      ingredients,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

  it("re-analyzes via FDC when the ingredients changed", async () => {
    existing([{ name: "flour", amount: 2, unit: "cups" }]);

    await updateRecipe(
      "recipe-1",
      baseData({ ingredients: [{ name: "flour", amount: 3, unit: "cups" }] })
    );

    expect(analyzeRecipeProfileAction).toHaveBeenCalledOnce();
  });

  it("does NOT re-analyze when the ingredients are unchanged", async () => {
    existing([{ name: "flour", amount: 2, unit: "cups" }]);

    const result = await updateRecipe(
      "recipe-1",
      baseData({
        title: "Renamed",
        calories: 999, // a hand-tuned macro the user edited
        ingredients: [{ name: "flour", amount: 2, unit: "cups" }],
      })
    );

    expect(analyzeRecipeProfileAction).not.toHaveBeenCalled();
    // Only the main update runs — no second profile-write that would clobber
    // the manually-edited macros.
    expect(prisma.recipe.update).toHaveBeenCalledOnce();
    expect(result.error).toBeNull();
  });

  it("writes the full profile and refreshes ingredient rows on change", async () => {
    existing([{ name: "flour", amount: 2, unit: "cups" }]);

    await updateRecipe(
      "recipe-1",
      baseData({ ingredients: [{ name: "flour", amount: 3, unit: "cups" }] })
    );

    // calls[0] = main row update; calls[1] = the profile write-back.
    expect(prisma.recipe.update).toHaveBeenCalledTimes(2);
    const profileWrite = vi.mocked(prisma.recipe.update).mock
      .calls[1][0] as unknown as { data: Record<string, number> };
    expect(profileWrite.data).toMatchObject(FULL_PROFILE);
    expect(prisma.recipeIngredient.deleteMany).toHaveBeenCalledWith({
      where: { recipeId: "recipe-1" },
    });
  });

  it("threads the recipe title to the analyzer for cache consistency", async () => {
    existing([{ name: "flour", amount: 2, unit: "cups" }]);

    await updateRecipe(
      "recipe-1",
      baseData({
        title: "Grandma's Bread",
        ingredients: [{ name: "flour", amount: 3, unit: "cups" }],
      })
    );

    expect(analyzeRecipeProfileAction).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Grandma's Bread" })
    );
  });

  it("a nutrition failure does not fail the edit", async () => {
    existing([{ name: "flour", amount: 2, unit: "cups" }]);
    vi.mocked(analyzeRecipeProfileAction).mockRejectedValueOnce(
      new Error("FDC down")
    );

    const result = await updateRecipe(
      "recipe-1",
      baseData({ ingredients: [{ name: "flour", amount: 3, unit: "cups" }] })
    );

    expect(result.error).toBeNull();
    expect(result.data).toBeTruthy();
  });
});
