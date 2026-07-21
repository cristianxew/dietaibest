import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/recipes/import/url/route";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { assertCanImportRecipe } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import { extractRecipe, selectIngestStrategy } from "@/lib/ingest/extract-recipe";
import { findExistingImport, recipeRowToImported } from "@/lib/ingest/recipe-dedup";
import { SupadataError } from "@/lib/supadata";
import { GemmaExtractionError } from "@/lib/chat/llm-gemma";
import type { ImportedRecipe } from "@/types/recipe";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const p = { user: { findUnique: vi.fn() } };
  return { prisma: p, default: p };
});

vi.mock("@/lib/entitlements", () => ({ assertCanImportRecipe: vi.fn() }));
vi.mock("@/lib/entitlement-error", () => ({ toEntitlementError: vi.fn(() => null) }));
vi.mock("@/lib/ingest/extract-recipe", () => ({
  extractRecipe: vi.fn(),
  selectIngestStrategy: vi.fn(() => "supadata-web"),
}));
vi.mock("@/lib/ingest/recipe-dedup", () => ({
  findExistingImport: vi.fn(),
  recipeRowToImported: vi.fn(),
}));

const baseUser = { id: "user-123", email: "user@dietai.test", plan: "pro", subscriptionStatus: "active" };

const validRecipe: ImportedRecipe = {
  title: "Pesto Pasta",
  ingredients: [{ name: "basil", amount: 1, unit: "cup" }],
  instructions: ["Blend"],
  sourceUrl: "https://example.com/pesto",
};

function jsonRequest(body: unknown): NextRequest {
  const req = new NextRequest("http://localhost/api/recipes/import/url", {
    method: "POST",
    body: JSON.stringify(body),
  });
  req.json = async () => body as never;
  return req;
}

describe("POST /api/recipes/import/url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: baseUser.email } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never);
    vi.mocked(assertCanImportRecipe).mockResolvedValue(undefined);
    vi.mocked(toEntitlementError).mockReturnValue(null);
    vi.mocked(selectIngestStrategy).mockReturnValue("supadata-web");
    vi.mocked(findExistingImport).mockResolvedValue(null);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("unauthorized");
  });

  it("returns 404 when the user is not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("user-not-found");
  });

  it("returns 403 when the plan lacks the import entitlement", async () => {
    vi.mocked(assertCanImportRecipe).mockRejectedValue(new Error("pro only"));
    vi.mocked(toEntitlementError).mockReturnValue({ code: "PRO_ONLY", feature: "recipeImport" } as never);
    const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PRO_ONLY");
  });

  it("returns 400 when the url is missing", async () => {
    const res = await POST(jsonRequest({ url: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid-url");
    expect(extractRecipe).not.toHaveBeenCalled();
  });

  it("returns 400 when the url cannot be classified", async () => {
    vi.mocked(selectIngestStrategy).mockImplementation(() => {
      throw new Error("bad url");
    });
    const res = await POST(jsonRequest({ url: "not a url" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid-url");
  });

  it("returns 200 with the extracted recipe on success", async () => {
    vi.mocked(extractRecipe).mockResolvedValue(validRecipe);
    const res = await POST(jsonRequest({ url: "https://example.com/pesto", locale: "es" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recipe.title).toBe("Pesto Pasta");
    expect(extractRecipe).toHaveBeenCalledWith("supadata-web", "https://example.com/pesto", "es");
  });

  it("defaults to locale 'en' when an unknown locale is sent", async () => {
    vi.mocked(extractRecipe).mockResolvedValue(validRecipe);
    await POST(jsonRequest({ url: "https://example.com/pesto", locale: "zz" }));
    expect(extractRecipe).toHaveBeenCalledWith("supadata-web", "https://example.com/pesto", "en");
  });

  it("returns 422 when no usable recipe is extracted", async () => {
    vi.mocked(extractRecipe).mockResolvedValue({
      ...validRecipe,
      title: "Pesto Pasta",
      ingredients: [],
    });
    const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("no-recipe");
  });

  it("maps a Gemma extraction failure to 422 no-recipe", async () => {
    vi.mocked(extractRecipe).mockRejectedValue(
      new GemmaExtractionError("no-ingredients", "nope")
    );
    const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("no-recipe");
  });

  it("maps a Supadata 429 to 429 rate-limited", async () => {
    vi.mocked(extractRecipe).mockRejectedValue(
      new SupadataError("REQUEST_ERROR", "Rate limit exceeded", 429)
    );
    const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("rate-limited");
  });

  it("maps an unexpected error to 500 generic", async () => {
    vi.mocked(extractRecipe).mockRejectedValue(new Error("boom"));
    const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error.code).toBe("generic");
  });

  describe("import dedup", () => {
    const ownRow = { id: "recipe-own", title: "My Pesto" };
    const otherRow = { id: "recipe-other", title: "Their Pesto" };

    it("returns alreadyImported for the user's own previous import, skipping extraction", async () => {
      vi.mocked(findExistingImport).mockResolvedValue({
        kind: "own",
        recipe: ownRow,
      } as never);

      const res = await POST(jsonRequest({ url: "https://example.com/pesto?utm_source=x" }));

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        alreadyImported: { id: "recipe-own", title: "My Pesto" },
      });
      expect(findExistingImport).toHaveBeenCalledWith(
        "https://example.com/pesto",
        baseUser.id
      );
      expect(extractRecipe).not.toHaveBeenCalled();
    });

    it("returns another user's import as the preview with dedupSourceRecipeId, skipping extraction", async () => {
      vi.mocked(findExistingImport).mockResolvedValue({
        kind: "other",
        recipe: otherRow,
      } as never);
      vi.mocked(recipeRowToImported).mockReturnValue(validRecipe);

      const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.recipe.title).toBe("Pesto Pasta");
      expect(json.dedupSourceRecipeId).toBe("recipe-other");
      expect(recipeRowToImported).toHaveBeenCalledWith(otherRow, "https://example.com/pesto");
      expect(extractRecipe).not.toHaveBeenCalled();
    });

    it("falls through to extraction on a dedup miss", async () => {
      vi.mocked(extractRecipe).mockResolvedValue(validRecipe);
      const res = await POST(jsonRequest({ url: "https://example.com/pesto" }));
      expect(res.status).toBe(200);
      expect((await res.json()).dedupSourceRecipeId).toBeUndefined();
      expect(extractRecipe).toHaveBeenCalledOnce();
    });
  });
});
