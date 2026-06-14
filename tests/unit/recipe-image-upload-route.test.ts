import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST } from "@/app/api/recipes/image-upload/route";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import * as storage from "@/lib/storage/recipe-images";
import sharp from "sharp";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

vi.mock("@/lib/prisma", () => {
  const p = { user: { findUnique: vi.fn() } };
  return { prisma: p, default: p };
});

vi.mock("@/lib/storage/recipe-images", () => ({
  uploadRecipeImage: vi.fn(),
  getPublicUrl: vi.fn(),
  RECIPE_IMAGES_BUCKET: "recipe-images",
}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("optimized")),
  })),
}));

const baseUser = { id: "user-123", email: "user@dietai.test" };

function fileRequest(fileType = "image/jpeg", fileName = "photo.jpg", fileSize = 500): NextRequest {
  const file = new File([new ArrayBuffer(fileSize)], fileName, { type: fileType });
  file.arrayBuffer = async () => new ArrayBuffer(fileSize);
  const formData = new FormData();
  formData.append("file", file);
  const req = new NextRequest("http://localhost/api/recipes/image-upload", {
    method: "POST",
    body: formData,
  });
  req.formData = async () => formData;
  return req;
}

describe("POST /api/recipes/image-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({ user: { email: baseUser.email } } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never);
    vi.mocked(storage.getPublicUrl).mockReturnValue("https://supabase/recipe-images/recipes/_uploads/user-123/x.jpg");
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await POST(fileRequest());
    expect(res.status).toBe(401);
  });

  it("returns 404 when the user is not found", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const res = await POST(fileRequest());
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("user-not-found");
  });

  it("returns 400 when the file field is missing", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost/api/recipes/image-upload", { method: "POST", body: formData });
    req.formData = async () => formData;
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("missing-file");
  });

  it("returns 413 when the file exceeds the size limit", async () => {
    const res = await POST(fileRequest("image/jpeg", "huge.jpg", 11 * 1024 * 1024));
    expect(res.status).toBe(413);
    expect((await res.json()).error.code).toBe("file-too-large");
  });

  it("returns 415 for an unsupported file type", async () => {
    const res = await POST(fileRequest("image/gif", "x.gif"));
    expect(res.status).toBe(415);
    expect((await res.json()).error.code).toBe("unsupported-format");
  });

  it("optimizes, uploads, and returns the public URL", async () => {
    const res = await POST(fileRequest("image/png", "photo.png"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imageUrl).toContain("recipe-images");
    expect(sharp).toHaveBeenCalled();
    expect(storage.uploadRecipeImage).toHaveBeenCalledWith(
      expect.stringMatching(/^recipes\/_uploads\/user-123\/[a-f0-9-]+\.jpg$/),
      expect.any(Buffer),
      "image/jpeg"
    );
  });
});
