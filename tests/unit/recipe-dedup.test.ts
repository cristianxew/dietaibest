import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    recipe: { findFirst: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { findExistingImport, recipeRowToImported } from "@/lib/ingest/recipe-dedup";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "recipe-1",
  userId: "user-a",
  title: "Carbonara",
  description: "Classic",
  imageUrl: "https://img.example.com/c.jpg",
  prepTime: 10,
  cookTime: 20,
  servings: 2,
  difficulty: "easy",
  ingredients: [{ name: "spaghetti", amount: 200, unit: "g" }],
  instructions: ["boil", "mix"],
  tags: ["imported", "pasta"],
  source: "url",
  sourceUrl: "https://example.com/carbonara?utm_source=x",
  canonicalUrl: "https://example.com/carbonara",
  calories: 500,
  protein: 20,
  carbs: 60,
  fat: 18,
  fiber: 3,
  sugar: 2,
  sodium: 400,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findExistingImport", () => {
  it("returns the user's own latest import first, without querying others", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.recipe.findFirst).mockResolvedValueOnce(row() as any);

    const match = await findExistingImport("https://example.com/carbonara", "user-a");

    expect(match).toEqual({ kind: "own", recipe: row() });
    expect(prisma.recipe.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.recipe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          canonicalUrl: "https://example.com/carbonara",
          source: "url",
        }),
        orderBy: { createdAt: "desc" },
      })
    );
  });

  it("prefers another user's import with completed nutrition", async () => {
    const analyzed = row({ id: "recipe-2", userId: "user-b" });
    vi.mocked(prisma.recipe.findFirst)
      .mockResolvedValueOnce(null) // own
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(analyzed as any); // other, calories not null

    const match = await findExistingImport("https://example.com/carbonara", "user-a");

    expect(match).toEqual({ kind: "other", recipe: analyzed });
    const secondCall = vi.mocked(prisma.recipe.findFirst).mock.calls[1][0];
    expect(secondCall?.where).toMatchObject({
      canonicalUrl: "https://example.com/carbonara",
      source: "url",
      calories: { not: null },
    });
  });

  it("falls back to another user's unanalyzed import", async () => {
    const unanalyzed = row({ id: "recipe-3", userId: "user-b", calories: null });
    vi.mocked(prisma.recipe.findFirst)
      .mockResolvedValueOnce(null) // own
      .mockResolvedValueOnce(null) // other analyzed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(unanalyzed as any); // other, any

    const match = await findExistingImport("https://example.com/carbonara", "user-a");

    expect(match).toEqual({ kind: "other", recipe: unanalyzed });
  });

  it("returns null when nobody imported the URL", async () => {
    vi.mocked(prisma.recipe.findFirst).mockResolvedValue(null);

    await expect(
      findExistingImport("https://example.com/carbonara", "user-a")
    ).resolves.toBeNull();
    expect(prisma.recipe.findFirst).toHaveBeenCalledTimes(3);
  });
});

describe("recipeRowToImported", () => {
  it("maps the row to the preview shape with the NEW importer's raw URL", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imported = recipeRowToImported(row() as any, "https://example.com/carbonara?fbclid=y");

    expect(imported).toMatchObject({
      title: "Carbonara",
      description: "Classic",
      prepTime: 10,
      cookTime: 20,
      servings: 2,
      difficulty: "easy",
      ingredients: [{ name: "spaghetti", amount: 200, unit: "g" }],
      instructions: ["boil", "mix"],
      imageUrl: "https://img.example.com/c.jpg",
      tags: ["imported", "pasta"],
      calories: 500,
      protein: 20,
      carbs: 60,
      fat: 18,
      fiber: 3,
      sugar: 2,
      sodium: 400,
      sourceUrl: "https://example.com/carbonara?fbclid=y",
    });
  });

  it("converts null optionals to undefined and guards non-array ingredients", () => {
    const sparse = row({
      description: null,
      imageUrl: null,
      prepTime: null,
      cookTime: null,
      difficulty: null,
      ingredients: { corrupted: true },
      calories: null,
      protein: null,
      carbs: null,
      fat: null,
      fiber: null,
      sugar: null,
      sodium: null,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imported = recipeRowToImported(sparse as any, "https://example.com/x");

    expect(imported.ingredients).toEqual([]);
    expect(imported.description).toBeUndefined();
    expect(imported.calories).toBeUndefined();
    expect(imported.imageUrl).toBeUndefined();
  });
});
