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
  isPublic: true,
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
      isPublic: true,
      calories: { gt: 0 },
    });
  });

  it("does not prefer an other-user match with an all-zero profile (calories: 0)", async () => {
    // calories:{gt:0} excludes a zero-calorie row at the DB level (a real
    // FDC-analysis-succeeded-but-resolved-nothing profile) — it falls through
    // to the "any" query instead of being preferred as the analyzed source.
    const fallback = row({ id: "recipe-6", userId: "user-b", calories: null });
    vi.mocked(prisma.recipe.findFirst)
      .mockResolvedValueOnce(null) // own
      .mockResolvedValueOnce(null) // other analyzed — excluded (calories: 0)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce(fallback as any); // other any

    const match = await findExistingImport("https://example.com/carbonara", "user-a");

    expect(match).toEqual({ kind: "other", recipe: fallback });
    const analyzedCall = vi.mocked(prisma.recipe.findFirst).mock.calls[1][0];
    expect(analyzedCall?.where).toMatchObject({ calories: { gt: 0 } });
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
    const thirdCall = vi.mocked(prisma.recipe.findFirst).mock.calls[2][0];
    expect(thirdCall?.where).toMatchObject({ isPublic: true });
  });

  describe("visibility guard on other-user matches", () => {
    it("does not return a private other-user recipe (falls through to null)", async () => {
      // Both other-user queries now filter isPublic:true; a real DB excludes a
      // private row from both, so the mocks return null for them too — the
      // pre-fix code would have matched this row regardless of visibility.
      vi.mocked(prisma.recipe.findFirst)
        .mockResolvedValueOnce(null) // own
        .mockResolvedValueOnce(null) // other analyzed — excluded (private)
        .mockResolvedValueOnce(null); // other any — excluded (private)

      const match = await findExistingImport("https://example.com/carbonara", "user-a");

      expect(match).toBeNull();
      const [, analyzedCall, anyCall] = vi.mocked(prisma.recipe.findFirst).mock.calls;
      expect(analyzedCall[0]?.where).toMatchObject({ isPublic: true });
      expect(anyCall[0]?.where).toMatchObject({ isPublic: true });
    });

    it("returns a public other-user recipe", async () => {
      const publicMatch = row({ id: "recipe-4", userId: "user-b", isPublic: true });
      vi.mocked(prisma.recipe.findFirst)
        .mockResolvedValueOnce(null) // own
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .mockResolvedValueOnce(publicMatch as any); // other analyzed, public

      const match = await findExistingImport("https://example.com/carbonara", "user-a");

      expect(match).toEqual({ kind: "other", recipe: publicMatch });
    });
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

  it("drops out-of-enum difficulty values (strict re-parse in the chat resume path)", () => {
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recipeRowToImported(row({ difficulty: "Fácil" }) as any, "https://example.com/x")
        .difficulty
    ).toBeUndefined();
    expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recipeRowToImported(row({ difficulty: "easy" }) as any, "https://example.com/x")
        .difficulty
    ).toBe("easy");
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

  it("maps string-shaped ingredients instead of dropping them", () => {
    const stringRow = row({ ingredients: ["2 cups flour", "1 egg"] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imported = recipeRowToImported(stringRow as any, "https://example.com/x");

    expect(imported.ingredients).toHaveLength(2);
    expect(imported.ingredients).not.toEqual([]);
    expect(imported.ingredients[0].name).toBe("flour");
    expect(imported.ingredients[1].name).toBe("egg");
  });
});
