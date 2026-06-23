import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import type { AgentContext } from "@/lib/chat/context";
import type { Entitlements } from "@/lib/entitlements";
import { GemmaExtractionError, GemmaProvider } from "@/lib/chat/llm-gemma";
import {
  importRecipeFromImage,
  setGemmaProviderForTest,
} from "@/lib/chat/tools/importRecipeFromImage";

vi.mock("@/actions/recipe", () => ({
  persistRecipe: vi.fn(),
}));

vi.mock("@/lib/storage/chat-recipe-media", () => ({
  downloadBytes: vi.fn(async () => new Uint8Array([0xff, 0xd8, 0xff])),
}));

// Prisma mock — vi.hoisted runs alongside the mock hoist so the fake is
// available when the mock factory is invoked. `prisma` is a default export
// per src/lib/prisma.ts; some call sites also use the named export.
const prismaFake = vi.hoisted(() => ({
  multimodalImportEvent: {
    findUnique: vi.fn(),
    update: vi.fn(async (args: unknown) => args),
    count: vi.fn(async () => 0),
  },
}));
vi.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaFake,
  prisma: prismaFake,
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
  return {
    userId: "u1",
    locale: "en",
    conversationId: "c1",
    entitlements: PRO,
  };
}

function makeGemmaProvider(
  extract: GemmaProvider["extractRecipe"]
): GemmaProvider {
  // Cast through unknown because we're bypassing the constructor (which
  // requires GEMINI_API_KEY); the tool only ever calls extractRecipe.
  return { extractRecipe: extract } as unknown as GemmaProvider;
}

describe("importRecipeFromImage tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaFake.multimodalImportEvent.findUnique.mockReset();
    prismaFake.multimodalImportEvent.update.mockImplementation(
      async (args: unknown) => args
    );
    prismaFake.multimodalImportEvent.count.mockResolvedValue(0);
  });

  afterEach(() => {
    setGemmaProviderForTest(null);
  });

  const validEvent = {
    id: "11111111-1111-1111-1111-111111111111",
    userId: "u1",
    mediaPath: "u1/11111111-1111-1111-1111-111111111111.jpg",
    mimeType: "image/jpeg",
    outcome: "pending",
    deletedAt: null,
  };

  it("happy path: extracts, persists, returns link", async () => {
    prismaFake.multimodalImportEvent.findUnique.mockResolvedValue(validEvent);

    setGemmaProviderForTest(
      makeGemmaProvider(async () => ({
        title: "Tortilla de patatas",
        ingredients: [
          { name: "huevos", amount: 6, unit: "u" },
          { name: "papas", amount: 500, unit: "g" },
        ],
        instructions: ["Pelar las papas.", "Batir los huevos."],
      }))
    );

    const { persistRecipe } = await import("@/actions/recipe");
    vi.mocked(persistRecipe).mockResolvedValue({
      data: { id: "recipe-1", title: "Tortilla de patatas" } as never,
      error: null,
    } as Awaited<ReturnType<typeof persistRecipe>>);

    const result = await importRecipeFromImage.execute(
      { eventId: validEvent.id },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe("recipe-1");
      expect(result.link?.href).toBe("/recipes/recipe-1");
    }
    // Final event update marks success + recipeId
    const updates = prismaFake.multimodalImportEvent.update.mock.calls;
    expect(updates.length).toBeGreaterThan(0);
    const last = updates[updates.length - 1][0] as { data: Record<string, unknown> };
    expect(last.data.outcome).toBe("success");
    expect(last.data.recipeId).toBe("recipe-1");
  });

  it("event not found → tool.failed with reason notFound", async () => {
    prismaFake.multimodalImportEvent.findUnique.mockResolvedValue(null);

    const result = await importRecipeFromImage.execute(
      { eventId: validEvent.id },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("notFound");
  });

  it("event owned by another user → tool.failed with reason unauthorized", async () => {
    prismaFake.multimodalImportEvent.findUnique.mockResolvedValue({
      ...validEvent,
      userId: "other-user",
    });

    const result = await importRecipeFromImage.execute(
      { eventId: validEvent.id },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("unauthorized");
  });

  it("daily cap exceeded → tool.failed with reason quota + event marked failure", async () => {
    prismaFake.multimodalImportEvent.findUnique.mockResolvedValue(validEvent);
    // Strictly > MULTIMODAL_DAILY_CAP triggers the block in the tool.
    prismaFake.multimodalImportEvent.count.mockResolvedValue(11);

    const result = await importRecipeFromImage.execute(
      { eventId: validEvent.id },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("quota");

    const updates = prismaFake.multimodalImportEvent.update.mock.calls;
    expect(updates.length).toBeGreaterThan(0);
    const last = updates[updates.length - 1][0] as { data: Record<string, unknown> };
    expect(last.data.outcome).toBe("failure");
    expect(last.data.reason).toBe("cost-cap-day");
  });

  it("Gemma low-quality error → tool.failed with reason notFound + event marked failure low-quality", async () => {
    prismaFake.multimodalImportEvent.findUnique.mockResolvedValue(validEvent);

    setGemmaProviderForTest(
      makeGemmaProvider(async () => {
        throw new GemmaExtractionError("low-quality", "blurry photo");
      })
    );

    const result = await importRecipeFromImage.execute(
      { eventId: validEvent.id },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("notFound");

    const updates = prismaFake.multimodalImportEvent.update.mock.calls;
    expect(updates.length).toBeGreaterThan(0);
    const last = updates[updates.length - 1][0] as { data: Record<string, unknown> };
    expect(last.data.outcome).toBe("failure");
    expect(last.data.reason).toBe("low-quality");
  });
});
