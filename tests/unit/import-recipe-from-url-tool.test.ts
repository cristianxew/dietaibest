import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/recipe", () => ({ persistRecipe: vi.fn() }));
vi.mock("@/lib/ingest/extract-recipe", () => ({ extractRecipe: vi.fn() }));
vi.mock("@/lib/ingest/recipe-dedup", () => ({
  findExistingImport: vi.fn(),
  recipeRowToImported: vi.fn(),
}));

import { persistRecipe } from "@/actions/recipe";
import { extractRecipe } from "@/lib/ingest/extract-recipe";
import {
  findExistingImport,
  recipeRowToImported,
} from "@/lib/ingest/recipe-dedup";
import { importRecipeFromUrl } from "@/lib/chat/tools/importRecipeFromUrl";
import type { AgentContext } from "@/lib/chat/context";

const ctx = { userId: "user-1", locale: "en" } as AgentContext;
const url = "https://example.com/pesto?utm_source=x";

// No type annotation on purpose: the literal must satisfy both ImportedRecipe
// (recipeRowToImported's return) and the tool input's stricter recipe schema
// (difficulty as enum).
const preview = {
  title: "Pesto Pasta",
  ingredients: [{ name: "basil", amount: 1, unit: "cup" }],
  instructions: ["Blend"],
  sourceUrl: url,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(findExistingImport).mockResolvedValue(null);
});

describe("importRecipeFromUrl — requiresConfirmation dedup", () => {
  it("skips the preview for the user's own previous import", async () => {
    vi.mocked(findExistingImport).mockResolvedValue({
      kind: "own",
      recipe: { id: "r-own", title: "My Pesto" },
    } as never);

    const descriptor = await importRecipeFromUrl.requiresConfirmation!(
      { url },
      ctx
    );

    expect(descriptor).toBeNull();
    expect(findExistingImport).toHaveBeenCalledWith(
      "https://example.com/pesto",
      "user-1"
    );
    expect(extractRecipe).not.toHaveBeenCalled();
  });

  it("builds the preview from another user's import without extracting", async () => {
    vi.mocked(findExistingImport).mockResolvedValue({
      kind: "other",
      recipe: { id: "r-other", title: "Their Pesto" },
    } as never);
    vi.mocked(recipeRowToImported).mockReturnValue(preview);

    const descriptor = await importRecipeFromUrl.requiresConfirmation!(
      { url },
      ctx
    );

    expect(descriptor?.message).toBe("Pesto Pasta");
    expect(descriptor?.payload).toMatchObject({
      url,
      confirmed: true,
      recipe: preview,
      dedupSourceRecipeId: "r-other",
    });
    expect(extractRecipe).not.toHaveBeenCalled();
  });

  it("extracts normally on a dedup miss", async () => {
    vi.mocked(extractRecipe).mockResolvedValue(preview);

    const descriptor = await importRecipeFromUrl.requiresConfirmation!(
      { url },
      ctx
    );

    expect(extractRecipe).toHaveBeenCalledOnce();
    expect(descriptor?.payload).toMatchObject({ recipe: preview });
  });
});

describe("importRecipeFromUrl — execute dedup", () => {
  it("short-circuits with alreadyImported for the user's own previous import", async () => {
    vi.mocked(findExistingImport).mockResolvedValue({
      kind: "own",
      recipe: { id: "r-own", title: "My Pesto", imageUrl: null },
    } as never);

    const result = await importRecipeFromUrl.execute({ url }, ctx);

    expect(result).toEqual({
      ok: true,
      data: {
        id: "r-own",
        title: "My Pesto",
        hasImage: false,
        alreadyImported: true,
      },
      link: { type: "recipe", href: "/recipes/r-own", label: "My Pesto" },
    });
    expect(persistRecipe).not.toHaveBeenCalled();
  });

  it("forwards dedupSourceRecipeId to persistRecipe on a confirmed cross-user import", async () => {
    vi.mocked(persistRecipe).mockResolvedValue({
      data: { id: "r-new", title: "Pesto Pasta" },
    } as never);

    const result = await importRecipeFromUrl.execute(
      { url, confirmed: true, recipe: preview, dedupSourceRecipeId: "r-other" },
      ctx
    );

    expect(result.ok).toBe(true);
    expect(persistRecipe).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Pesto Pasta" }),
      expect.objectContaining({
        source: "url",
        sourceUrl: url,
        dedupSourceRecipeId: "r-other",
      })
    );
  });
});
