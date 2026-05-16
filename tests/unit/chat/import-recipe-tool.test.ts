import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { AgentContext } from "@/lib/chat/context";
import type { Entitlements } from "@/lib/entitlements";

// Hoisted-friendly mocks: vitest evaluates vi.mock() at the top of the module
// regardless of import order, so the factory functions can't capture local
// variables — we resolve mocks dynamically via vi.mocked() inside each test.
vi.mock("@/actions/recipe", () => ({
  persistRecipe: vi.fn(),
}));

const PRO: Entitlements = {
  isPro: true,
  limits: {
    savedRecipes: Number.POSITIVE_INFINITY,
    recipesCreatedPerMonth: Number.POSITIVE_INFINITY,
    importsPerMonth: Number.POSITIVE_INFINITY,
    mealPlanTemplates: Number.POSITIVE_INFINITY,
    mealPlanDurationDays: Number.POSITIVE_INFINITY,
    edamamAnalysesPerMonth: Number.POSITIVE_INFINITY,
  },
  features: {
    aiMealPlan: true,
    shoppingAutomation: true,
    recipeImport: true,
    aiChat: true,
  },
};

function makeCtx(): AgentContext {
  return {
    userId: "u1",
    locale: "en",
    conversationId: "c1",
    entitlements: PRO,
  };
}

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("importRecipeFromUrl tool", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SUPADATA_API_KEY = "test-key";
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("successfully imports a recipe from a TikTok URL via /extract and persists with a link", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ jobId: "j-1" }, 202))
      .mockImplementationOnce(async () =>
        jsonResponse({
          status: "completed",
          data: {
            title: "Tacos al pastor",
            description: "Tacos clásicos",
            servings: 4,
            ingredients: [
              { name: "Carne de cerdo", amount: 500, unit: "g" },
              { name: "Piña", amount: 200, unit: "g" },
            ],
            instructions: ["Marinar la carne", "Asar y servir"],
            tags: ["mexican"],
          },
        })
      );

    const { persistRecipe } = await import("@/actions/recipe");
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: { id: "r-1", title: "Tacos al pastor" } as never,
      error: null,
    });

    const { importRecipeFromUrl } = await import(
      "@/lib/chat/tools/importRecipeFromUrl"
    );

    const result = await importRecipeFromUrl.execute(
      { url: "https://www.tiktok.com/@chef/video/123" },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ id: "r-1", title: "Tacos al pastor" });
      expect(result.link).toEqual({
        type: "recipe",
        href: "/recipes/r-1",
        label: "Tacos al pastor",
      });
    }

    // Confirm persistRecipe was invoked with source: "url"
    expect(vi.mocked(persistRecipe)).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(persistRecipe).mock.calls[0]!;
    expect(options).toMatchObject({
      source: "url",
      sourceUrl: "https://www.tiktok.com/@chef/video/123",
      locale: "en",
    });
  });

  it("returns tool.failed (generic) when Supadata responds 5xx", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ message: "boom" }, 503)
    );

    const { importRecipeFromUrl } = await import(
      "@/lib/chat/tools/importRecipeFromUrl"
    );

    const result = await importRecipeFromUrl.execute(
      { url: "https://www.tiktok.com/@chef/video/zzz" },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
      expect(result.message).toContain("ingest-failed");
    }
  });

  it("returns tool.failed when /extract returns 200 with empty data", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ jobId: "j-empty" }, 202))
      .mockResolvedValueOnce(jsonResponse({ status: "completed", data: {} }));

    const { importRecipeFromUrl } = await import(
      "@/lib/chat/tools/importRecipeFromUrl"
    );

    const result = await importRecipeFromUrl.execute(
      { url: "https://www.tiktok.com/@chef/video/empty" },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("notFound");
      expect(result.message).toContain("no-ingredients");
    }
  });

  it("returns tool.failed (no-ingredients) when title is present but ingredients is empty", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ jobId: "j-no-ing" }, 202))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "completed",
          data: {
            title: "Some recipe",
            ingredients: [],
            instructions: ["step"],
          },
        })
      );

    const { importRecipeFromUrl } = await import(
      "@/lib/chat/tools/importRecipeFromUrl"
    );

    const result = await importRecipeFromUrl.execute(
      { url: "https://www.tiktok.com/@chef/video/noing" },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("no-ingredients");
    }
  });

  it("uses /web/scrape for non-video URLs and parses ingredients from markdown", async () => {
    const markdown = [
      "# Chocolate Chip Cookies",
      "",
      "## Ingredients",
      "- 2 cups flour",
      "- 1 cup sugar",
      "- 200 g butter",
      "",
      "## Instructions",
      "1. Cream the butter and sugar.",
      "2. Add flour and mix.",
      "3. Bake at 180 for 12 minutes.",
    ].join("\n");

    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        url: "https://recipes.example.com/cookies",
        content: markdown,
        name: "Chocolate Chip Cookies",
        description: "A classic.",
      })
    );

    const { persistRecipe } = await import("@/actions/recipe");
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: { id: "r-web", title: "Chocolate Chip Cookies" } as never,
      error: null,
    });

    const { importRecipeFromUrl } = await import(
      "@/lib/chat/tools/importRecipeFromUrl"
    );

    const result = await importRecipeFromUrl.execute(
      { url: "https://recipes.example.com/cookies" },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link?.href).toBe("/recipes/r-web");
    }

    const [calledUrl] = fetchSpy.mock.calls[0]!;
    expect(calledUrl).toContain("/web/scrape");

    const [recipeData] = vi.mocked(persistRecipe).mock.calls[0]!;
    expect(recipeData.title).toBe("Chocolate Chip Cookies");
    expect(recipeData.ingredients.length).toBe(3);
    expect(recipeData.instructions.length).toBe(3);
  });

  it("returns tool.failed (unauthorized) when persistRecipe rejects with PRO_ONLY", async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ jobId: "j-paid" }, 202))
      .mockResolvedValueOnce(
        jsonResponse({
          status: "completed",
          data: {
            title: "Risotto",
            ingredients: [{ name: "Arroz", amount: 200, unit: "g" }],
            instructions: ["Cocinar"],
          },
        })
      );

    const { persistRecipe } = await import("@/actions/recipe");
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: null,
      error: { code: "PRO_ONLY", message: "Pro only" } as never,
    });

    const { importRecipeFromUrl } = await import(
      "@/lib/chat/tools/importRecipeFromUrl"
    );

    const result = await importRecipeFromUrl.execute(
      { url: "https://youtu.be/abc" },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unauthorized");
    }
  });
});
