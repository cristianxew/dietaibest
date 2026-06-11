import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentContext } from "@/lib/chat/context";
import type { Entitlements } from "@/lib/entitlements";
import {
  generateRecipeImage,
  setGoogleGenAIClientForTest,
} from "@/lib/chat/tools/generateRecipeImage";
import * as storage from "@/lib/storage/recipe-images";
import sharp from "sharp";

vi.mock("@/lib/storage/recipe-images", () => ({
  uploadRecipeImage: vi.fn(),
  deleteRecipeImage: vi.fn(),
  getPublicUrl: vi.fn(() => "https://supabase/recipes/recipe-123/new.jpg"),
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

const prismaFake = vi.hoisted(() => ({
  recipe: {
    findUnique: vi.fn(),
    update: vi.fn(),
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
    userId: "user-123",
    locale: "en",
    conversationId: "c1",
    entitlements: PRO,
  };
}

describe("generateRecipeImage tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setGoogleGenAIClientForTest(null);
  });

  const ownedRecipe = {
    id: "recipe-123",
    userId: "user-123",
    title: "Ensalada Caprese",
    description: "Fresh tomato and mozzarella salad",
    imageUrl: "https://supabase/storage/v1/object/public/recipe-images/recipes/recipe-123/old.jpg",
  };

  const otherRecipe = {
    id: "recipe-456",
    userId: "other-user",
    title: "Other Recipe",
    description: "Not owned",
    imageUrl: null,
  };

  it("returns notFound if the recipe does not exist", async () => {
    prismaFake.recipe.findUnique.mockResolvedValue(null);

    const result = await generateRecipeImage.execute({ recipeId: "missing-123" }, makeCtx());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("notFound");
      expect(result.message).toBe("Recipe not found");
    }
  });

  it("returns unauthorized if the recipe does not belong to the user", async () => {
    prismaFake.recipe.findUnique.mockResolvedValue(otherRecipe as any);

    const result = await generateRecipeImage.execute({ recipeId: "recipe-456" }, makeCtx());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unauthorized");
      expect(result.message).toBe("You are not authorized to update this recipe image");
    }
  });

  it("successfully generates, resizes, deletes old image, and updates DB on happy path", async () => {
    prismaFake.recipe.findUnique.mockResolvedValue(ownedRecipe as any);
    prismaFake.recipe.update.mockResolvedValue({ id: "recipe-123" } as any);

    const generateImagesMock = vi.fn().mockResolvedValue({
      generatedImages: [
        {
          image: {
            imageBytes: Buffer.from("fake-imagen-generated-bytes").toString("base64"),
          },
        },
      ],
    });

    const clientMock = {
      models: {
        generateImages: generateImagesMock,
      } as any,
    };

    setGoogleGenAIClientForTest(clientMock);

    const result = await generateRecipeImage.execute({ recipeId: "recipe-123" }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.imageUrl).toBe("https://supabase/recipes/recipe-123/new.jpg");
      expect(result.link?.href).toBe("/recipes/recipe-123");
    }

    // Verify Google Gen AI mock was called correctly
    expect(generateImagesMock).toHaveBeenCalledWith({
      model: "imagen-3.0-generate-002",
      prompt: expect.stringContaining("Premium professional food photography of Ensalada Caprese"),
      config: {
        numberOfImages: 1,
        aspectRatio: "4:3",
        outputMimeType: "image/jpeg",
        negativePrompt: expect.any(String),
      },
    });

    // Verify Sharp was invoked
    expect(sharp).toHaveBeenCalledWith(expect.any(Buffer));

    // Verify old image was deleted from storage
    expect(storage.deleteRecipeImage).toHaveBeenCalledWith("recipes/recipe-123/old.jpg");

    // Verify new image was uploaded to storage
    expect(storage.uploadRecipeImage).toHaveBeenCalledWith(
      expect.stringMatching(/^recipes\/recipe-123\/[a-f0-9-]+\.jpg$/),
      expect.any(Buffer),
      "image/jpeg"
    );

    // Verify prisma database update was executed
    expect(prismaFake.recipe.update).toHaveBeenCalledWith({
      where: { id: "recipe-123" },
      data: { imageUrl: "https://supabase/recipes/recipe-123/new.jpg" },
    });
  });

  it("handles Imagen API errors gracefully", async () => {
    prismaFake.recipe.findUnique.mockResolvedValue(ownedRecipe as any);

    const clientMock = {
      models: {
        generateImages: vi.fn().mockRejectedValue(new Error("Imagen service offline")),
      } as any,
    };

    setGoogleGenAIClientForTest(clientMock);

    const result = await generateRecipeImage.execute({ recipeId: "recipe-123" }, makeCtx());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
      expect(result.message).toContain("Google Imagen generation failed: Imagen service offline");
    }
  });

  describe("gated confirmation", () => {
    it("requires confirmation when askFirst is true and confirmed is not set", async () => {
      prismaFake.recipe.findUnique.mockResolvedValue({ title: "Super Food Recipe" } as any);

      const confirmReq = await generateRecipeImage.requiresConfirmation?.(
        { recipeId: "recipe-123", askFirst: true },
        makeCtx()
      );

      expect(confirmReq).not.toBeNull();
      expect(confirmReq?.message).toBe("Super Food Recipe");
      expect(confirmReq?.payload).toEqual({
        recipeId: "recipe-123",
        askFirst: true,
        confirmed: true,
      });
    });

    it("does not require confirmation when askFirst is false/undefined", async () => {
      const confirmReq1 = await generateRecipeImage.requiresConfirmation?.(
        { recipeId: "recipe-123" },
        makeCtx()
      );
      const confirmReq2 = await generateRecipeImage.requiresConfirmation?.(
        { recipeId: "recipe-123", askFirst: false },
        makeCtx()
      );

      expect(confirmReq1).toBeNull();
      expect(confirmReq2).toBeNull();
    });

    it("does not require confirmation when askFirst is true but confirmed is also true", async () => {
      const confirmReq = await generateRecipeImage.requiresConfirmation?.(
        { recipeId: "recipe-123", askFirst: true, confirmed: true },
        makeCtx()
      );

      expect(confirmReq).toBeNull();
    });

    it("fails execution immediately if askFirst is true but confirmed is not set", async () => {
      prismaFake.recipe.findUnique.mockResolvedValue({
        id: "recipe-123",
        userId: "user-123",
        title: "Imageless Recipe",
        description: null,
        imageUrl: null,
      } as never);

      const result = await generateRecipeImage.execute(
        { recipeId: "recipe-123", askFirst: true },
        makeCtx()
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe("generic");
        expect(result.message).toBe("Image generation requires confirmation");
      }
    });
  });

  describe("auto-offer on a recipe that already has an image (imported with photo)", () => {
    it("skips the confirmation prompt entirely", async () => {
      prismaFake.recipe.findUnique.mockResolvedValue({
        title: "Pastel Keto De Almendras",
        imageUrl: "https://keto-mojo.com/cake.jpg",
      } as never);

      const confirmReq = await generateRecipeImage.requiresConfirmation?.(
        { recipeId: "recipe-123", askFirst: true },
        makeCtx()
      );

      expect(confirmReq).toBeNull();
    });

    it("execute no-ops gracefully without calling the image model", async () => {
      prismaFake.recipe.findUnique.mockResolvedValue(ownedRecipe as never);
      const generateImages = vi.fn();
      setGoogleGenAIClientForTest({ models: { generateImages } } as never);

      const result = await generateRecipeImage.execute(
        { recipeId: "recipe-123", askFirst: true },
        makeCtx()
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.skippedExistingImage).toBe(true);
        expect(result.data.imageUrl).toBe(ownedRecipe.imageUrl);
      }
      expect(generateImages).not.toHaveBeenCalled();
      expect(prismaFake.recipe.update).not.toHaveBeenCalled();
    });

    it("still generates when the user explicitly confirmed (regeneration)", async () => {
      // askFirst+confirmed means the user clicked "Yes" — an existing image
      // must not block an explicit confirmation.
      prismaFake.recipe.findUnique.mockResolvedValue(ownedRecipe as never);
      prismaFake.recipe.update.mockResolvedValue({ id: "recipe-123" } as never);
      const clientMock = {
        models: {
          generateImages: vi.fn().mockResolvedValue({
            generatedImages: [
              { image: { imageBytes: Buffer.from("fake-image").toString("base64") } },
            ],
          }),
        },
      };
      setGoogleGenAIClientForTest(clientMock as never);

      const result = await generateRecipeImage.execute(
        { recipeId: "recipe-123", askFirst: true, confirmed: true },
        makeCtx()
      );

      expect(result.ok).toBe(true);
      expect(clientMock.models.generateImages).toHaveBeenCalledTimes(1);
    });
  });
});

