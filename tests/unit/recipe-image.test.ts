import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/recipes/[id]/image/route";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import * as storage from "@/lib/storage/recipe-images";
import sharp from "sharp";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    recipe: { findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    prisma: mockPrisma,
    default: mockPrisma,
  };
});

vi.mock("@/lib/storage/recipe-images", () => ({
  uploadRecipeImage: vi.fn(),
  deleteRecipeImage: vi.fn(),
  getPublicUrl: vi.fn(),
  RECIPE_IMAGES_BUCKET: "recipe-images",
}));

vi.mock("sharp", () => {
  const resizeMock = vi.fn().mockReturnThis();
  const jpegMock = vi.fn().mockReturnThis();
  const toBufferMock = vi.fn().mockResolvedValue(Buffer.from("mocked-optimized-jpeg-bytes"));

  const mSharp = vi.fn(() => ({
    resize: resizeMock,
    jpeg: jpegMock,
    toBuffer: toBufferMock,
  }));

  return { default: mSharp };
});

const baseUser = { id: "user-123", email: "user@dietai.test" };
const ownedRecipe = { id: "recipe-123", userId: "user-123", imageUrl: "https://supabase/storage/v1/object/public/recipe-images/recipes/recipe-123/old.jpg" };
const otherRecipe = { id: "recipe-456", userId: "other-user", imageUrl: null };

describe("Recipe Image API Route (POST /api/recipes/[id]/image)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: baseUser.email },
    } as any);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as any);
  });

  const createRequest = (fileType = "image/jpeg", fileName = "test.jpg", fileSize = 500) => {
    const file = new File([new ArrayBuffer(fileSize)], fileName, { type: fileType });
    file.arrayBuffer = async () => new ArrayBuffer(fileSize);
    const formData = new FormData();
    formData.append("file", file);
    const req = new NextRequest("http://localhost/api/recipes/recipe-123/image", {
      method: "POST",
      body: formData,
    });
    req.formData = async () => formData;
    return req;
  };

  it("returns 401 if user is not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-123" }) } as any);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("unauthorized");
  });

  it("returns 404 if authenticated user does not exist in database", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-123" }) } as any);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("user-not-found");
  });

  it("returns 404 if recipe does not exist", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(null);
    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-123" }) } as any);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error.code).toBe("recipe-not-found");
  });

  it("returns 403 if authenticated user does not own the recipe", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(otherRecipe as any);
    const req = createRequest();
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-456" }) } as any);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error.code).toBe("forbidden");
  });

  it("returns 400 if multipart form is missing file field", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(ownedRecipe as any);
    const formData = new FormData();
    const req = new NextRequest("http://localhost/api/recipes/recipe-123/image", {
      method: "POST",
      body: formData,
    });
    req.formData = async () => formData;
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-123" }) } as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("missing-file");
  });

  it("returns 413 if uploaded file size exceeds 10MB limit", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(ownedRecipe as any);
    const req = createRequest("image/jpeg", "huge.jpg", 11 * 1024 * 1024); // 11MB
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-123" }) } as any);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error.code).toBe("file-too-large");
  });

  it("returns 415 if uploaded file format is unsupported", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(ownedRecipe as any);
    const req = createRequest("image/gif", "test.gif");
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-123" }) } as any);
    expect(res.status).toBe(415);
    const json = await res.json();
    expect(json.error.code).toBe("unsupported-format");
  });

  it("successfully processes valid image, resizes, uploads, deletes previous, and updates DB", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(ownedRecipe as any);
    vi.mocked(storage.getPublicUrl).mockReturnValue("https://supabase/recipes/recipe-123/new.jpg");

    const req = createRequest("image/png", "test.png");
    const res = await POST(req, { params: Promise.resolve({ id: "recipe-123" }) } as any);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.imageUrl).toBe("https://supabase/recipes/recipe-123/new.jpg");

    // Verify sharp was called
    expect(sharp).toHaveBeenCalled();

    // Verify previous image was deleted
    expect(storage.deleteRecipeImage).toHaveBeenCalledWith("recipes/recipe-123/old.jpg");

    // Verify new image was uploaded
    expect(storage.uploadRecipeImage).toHaveBeenCalledWith(
      expect.stringMatching(/^recipes\/recipe-123\/[a-f0-9-]+\.jpg$/),
      expect.any(Buffer),
      "image/jpeg"
    );

    // Verify database update
    expect(prisma.recipe.update).toHaveBeenCalledWith({
      where: { id: "recipe-123" },
      data: { imageUrl: "https://supabase/recipes/recipe-123/new.jpg" },
    });
  });
});
