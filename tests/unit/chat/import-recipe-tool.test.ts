import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { AgentContext } from "@/lib/chat/context";
import type { Entitlements } from "@/lib/entitlements";
import { ToolFailure } from "@/lib/chat/tools/types";
import {
  GemmaProvider,
  GemmaExtractionError,
  setGemmaProviderForTest,
} from "@/lib/chat/llm-gemma";
import { persistRecipe } from "@/actions/recipe";
import { SupadataClient, setSupadataClientForTest } from "@/lib/supadata";
import { importRecipeFromUrl } from "@/lib/chat/tools/importRecipeFromUrl";

vi.mock("@/actions/recipe", () => ({
  persistRecipe: vi.fn(),
}));

const PRO: Entitlements = {
  isPro: true,
  limits: {
    savedRecipes: Number.POSITIVE_INFINITY,
    recipesCreatedPerMonth: Number.POSITIVE_INFINITY,
    mealPlanTemplates: Number.POSITIVE_INFINITY,
    mealPlanDurationDays: Number.POSITIVE_INFINITY,
  },
  features: {
    aiMealPlan: true,
    shoppingAutomation: true,
    recipeImport: true,
    aiChat: true,
  },
};

function makeCtx(): AgentContext {
  return { userId: "u1", locale: "en", conversationId: "c1", entitlements: PRO };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A GemmaProvider whose text extractor is fully scripted. */
function fakeTextProvider(
  impl: (args: { content: string }) => Promise<unknown>
): GemmaProvider {
  const p = Object.create(GemmaProvider.prototype) as GemmaProvider;
  // @ts-expect-error — override the only method the URL tool calls.
  p.extractRecipeFromText = impl;
  return p;
}

describe("importRecipeFromUrl — requiresConfirmation (preview)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.SUPADATA_API_KEY = "test-key";
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setGemmaProviderForTest(null);
    vi.clearAllMocks();
  });

  it("scrapes a web URL, extracts with AI, and returns a preview descriptor", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        url: "https://recipes.example.com/cookies",
        content: "# Cookies\n\nlots of markdown...",
        name: "Chocolate Chip Cookies",
        description: "A classic.",
      })
    );
    setGemmaProviderForTest(
      fakeTextProvider(async () => ({
        title: "Chocolate Chip Cookies",
        ingredients: [
          { name: "flour", amount: 2, unit: "cup" },
          { name: "sugar", amount: 1, unit: "cup" },
        ],
        instructions: ["Mix", "Bake"],
      }))
    );

    const descriptor = await importRecipeFromUrl.requiresConfirmation!(
      { url: "https://recipes.example.com/cookies" },
      makeCtx()
    );

    expect(descriptor).not.toBeNull();
    const payload = descriptor!.payload as {
      confirmed: boolean;
      recipe: { title: string; ingredients: unknown[] };
    };
    expect(payload.confirmed).toBe(true);
    expect(payload.recipe.title).toBe("Chocolate Chip Cookies");
    expect(payload.recipe.ingredients).toHaveLength(2);

    const [calledUrl] = fetchSpy.mock.calls[0]!;
    expect(String(calledUrl)).toContain("/web/scrape");
  });

  it("returns null (skip preview) when already confirmed", async () => {
    const descriptor = await importRecipeFromUrl.requiresConfirmation!(
      { url: "https://recipes.example.com/cookies", confirmed: true },
      makeCtx()
    );

    expect(descriptor).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws ToolFailure(notFound) when the page has no recipe", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({ url: "https://x.com/p", content: "category index", name: "Index" })
    );
    setGemmaProviderForTest(
      fakeTextProvider(async () => {
        throw new GemmaExtractionError("no-ingredients", "no recipe");
      })
    );

    await expect(
      importRecipeFromUrl.requiresConfirmation!(
        { url: "https://recipes.example.com/index" },
        makeCtx()
      )
    ).rejects.toBeInstanceOf(ToolFailure);
  });

  it("throws ToolFailure when Supadata scrape responds 5xx", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse({ message: "boom" }, 503));

    await expect(
      importRecipeFromUrl.requiresConfirmation!(
        { url: "https://recipes.example.com/down" },
        makeCtx()
      )
    ).rejects.toMatchObject({ reason: "generic" });
  });
});

describe("importRecipeFromUrl — rate-limit (429) handling", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.SUPADATA_API_KEY = "test-key";
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Retries disabled so a 429 surfaces immediately (no real backoff).
    setSupadataClientForTest(
      new SupadataClient({ apiKey: "test-key", maxRetries: 0 })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    warnSpy.mockRestore();
    setSupadataClientForTest(null);
    vi.clearAllMocks();
  });

  function rateLimited(): Response {
    return new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("surfaces a Supadata 429 as ToolFailure(rateLimited)", async () => {
    fetchSpy.mockResolvedValueOnce(rateLimited());

    await expect(
      importRecipeFromUrl.requiresConfirmation!(
        { url: "https://www.youtube.com/watch?v=abc" },
        makeCtx()
      )
    ).rejects.toMatchObject({ reason: "rateLimited" });
  });

  it("logs the upstream Supadata message alongside the 429 status", async () => {
    fetchSpy.mockResolvedValueOnce(rateLimited());

    await expect(
      importRecipeFromUrl.requiresConfirmation!(
        { url: "https://www.youtube.com/watch?v=abc" },
        makeCtx()
      )
    ).rejects.toBeInstanceOf(ToolFailure);

    expect(warnSpy).toHaveBeenCalledWith(
      "[importRecipeFromUrl] ImportFailure",
      expect.objectContaining({
        errorReason: "ingest-failed",
        errorCode: "REQUEST_ERROR",
        status: 429,
        errorMessage: "Rate limit exceeded",
      })
    );
  });
});

describe("importRecipeFromUrl — execute (persist confirmed recipe)", () => {
  beforeEach(() => {
    process.env.SUPADATA_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("persists the recipe from the payload without re-extracting", async () => {
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: { id: "r-web", title: "Chocolate Chip Cookies" } as never,
      error: null,
    });

    const result = await importRecipeFromUrl.execute(
      {
        url: "https://recipes.example.com/cookies",
        confirmed: true,
        recipe: {
          title: "Chocolate Chip Cookies",
          ingredients: [{ name: "flour", amount: 2, unit: "cup" }],
          instructions: ["Mix", "Bake"],
          sourceUrl: "https://recipes.example.com/cookies",
        },
      },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link?.href).toBe("/recipes/r-web");
    }
    expect(vi.mocked(persistRecipe)).toHaveBeenCalledTimes(1);
    const [, options] = vi.mocked(persistRecipe).mock.calls[0]!;
    expect(options).toMatchObject({ source: "url", locale: "en" });
  });

  it("maps PRO_ONLY persist errors to unauthorized", async () => {
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: null,
      error: { code: "PRO_ONLY", message: "Pro only" } as never,
    });

    const result = await importRecipeFromUrl.execute(
      {
        url: "https://recipes.example.com/cookies",
        confirmed: true,
        recipe: {
          title: "Risotto",
          ingredients: [{ name: "rice", amount: 200, unit: "g" }],
          instructions: ["Cook"],
        },
      },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unauthorized");
  });

  // The model decides whether to offer generateRecipeImage based on the import
  // result — without this signal it can only guess (and offered AI images for
  // recipes whose source page already provided a perfectly good photo).
  it("reports hasImage: true when the extracted recipe carried an image", async () => {
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: { id: "r-img", title: "Pastel Keto" } as never,
      error: null,
    });

    const result = await importRecipeFromUrl.execute(
      {
        url: "https://recipes.example.com/keto-cake",
        confirmed: true,
        recipe: {
          title: "Pastel Keto",
          ingredients: [{ name: "almonds", amount: 200, unit: "g" }],
          instructions: ["Mix", "Bake"],
          imageUrl: "https://recipes.example.com/keto-cake.jpg",
        },
      },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.hasImage).toBe(true);
  });

  it("reports hasImage: false when the extracted recipe had no image", async () => {
    vi.mocked(persistRecipe).mockResolvedValueOnce({
      data: { id: "r-noimg", title: "Risotto" } as never,
      error: null,
    });

    const result = await importRecipeFromUrl.execute(
      {
        url: "https://recipes.example.com/risotto",
        confirmed: true,
        recipe: {
          title: "Risotto",
          ingredients: [{ name: "rice", amount: 200, unit: "g" }],
          instructions: ["Cook"],
        },
      },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.hasImage).toBe(false);
  });
});
