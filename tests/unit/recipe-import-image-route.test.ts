import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/recipes/import/image/route";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { assertCanImportRecipe } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import { getMultimodalImportCountToday } from "@/lib/chat/multimodal-cap";
import { getGemmaProvider, GemmaExtractionError } from "@/lib/chat/llm-gemma";
import * as storage from "@/lib/storage/chat-recipe-media";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const p = {
    user: { findUnique: vi.fn() },
    multimodalImportEvent: { count: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return { prisma: p, default: p };
});

vi.mock("@/lib/entitlements", () => ({ assertCanImportRecipe: vi.fn() }));
vi.mock("@/lib/entitlement-error", () => ({ toEntitlementError: vi.fn(() => null) }));
vi.mock("@/lib/storage/chat-recipe-media", () => ({
  buildStoragePath: vi.fn(() => "user-123/evt.jpg"),
  uploadImage: vi.fn(),
}));
vi.mock("@/lib/chat/multimodal-cap", () => ({
  MULTIMODAL_DAILY_CAP: 10,
  getMultimodalImportCountToday: vi.fn(),
}));
vi.mock("@/lib/chat/llm-gemma", async (orig) => {
  const actual = await orig<typeof import("@/lib/chat/llm-gemma")>();
  return { ...actual, getGemmaProvider: vi.fn() };
});
vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("jpeg")),
  })),
}));

const baseUser = { id: "user-123", email: "user@dietai.test", plan: "pro", subscriptionStatus: "active" };

const extractRecipeMock = vi.fn();

function fileRequest(fileType = "image/jpeg", fileName = "recipe.jpg", fileSize = 500): NextRequest {
  const file = new File([new ArrayBuffer(fileSize)], fileName, { type: fileType });
  file.arrayBuffer = async () => new ArrayBuffer(fileSize);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("locale", "es");
  const req = new NextRequest("http://localhost/api/recipes/import/image", {
    method: "POST",
    body: formData,
  });
  req.formData = async () => formData;
  return req;
}

describe("POST /api/recipes/import/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: baseUser.email } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never);
    vi.mocked(assertCanImportRecipe).mockResolvedValue(undefined);
    vi.mocked(toEntitlementError).mockReturnValue(null);
    vi.mocked(getMultimodalImportCountToday).mockResolvedValue(0);
    vi.mocked(prisma.multimodalImportEvent.create).mockResolvedValue({} as never);
    vi.mocked(prisma.multimodalImportEvent.update).mockResolvedValue({} as never);
    extractRecipeMock.mockReset();
    vi.mocked(getGemmaProvider).mockReturnValue({ extractRecipe: extractRecipeMock } as never);
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(fileRequest());
    expect(res.status).toBe(401);
  });

  it("returns 403 when the plan lacks the import entitlement", async () => {
    vi.mocked(assertCanImportRecipe).mockRejectedValue(new Error("pro only"));
    vi.mocked(toEntitlementError).mockReturnValue({ code: "PRO_ONLY", feature: "recipeImport" } as never);
    const res = await POST(fileRequest());
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("PRO_ONLY");
  });

  it("returns 429 when the daily cap is reached", async () => {
    vi.mocked(getMultimodalImportCountToday).mockResolvedValue(10);
    const res = await POST(fileRequest());
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("daily-cap");
    expect(extractRecipeMock).not.toHaveBeenCalled();
  });

  it("returns 415 for an unsupported file type", async () => {
    const res = await POST(fileRequest("image/gif", "x.gif"));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("unsupported-format");
  });

  it("returns 413 for a file over the size limit", async () => {
    const res = await POST(fileRequest("image/jpeg", "huge.jpg", 11 * 1024 * 1024));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("file-too-large");
  });

  it("accepts a PDF and returns the extracted recipe", async () => {
    extractRecipeMock.mockResolvedValue({
      title: "Tarta",
      ingredients: [{ name: "harina", amount: 200, unit: "g" }],
      instructions: ["Mezclar"],
    });
    const res = await POST(fileRequest("application/pdf", "recipe.pdf"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.recipe.title).toBe("Tarta");
    expect(json.eventId).toBeTruthy();
    expect(storage.uploadImage).toHaveBeenCalled();
    expect(prisma.multimodalImportEvent.create).toHaveBeenCalled();
    // success outcome recorded
    expect(prisma.multimodalImportEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "success" }) })
    );
  });

  it("returns 422 and records failure when extraction finds no recipe", async () => {
    extractRecipeMock.mockRejectedValue(new GemmaExtractionError("no-ingredients", "nope"));
    const res = await POST(fileRequest());
    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe("no-recipe");
    expect(prisma.multimodalImportEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outcome: "failure", reason: "no-ingredients" }) })
    );
  });
});
