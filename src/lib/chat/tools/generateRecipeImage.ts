import { z } from "zod";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { GoogleGenAI } from "@google/genai";

import { prisma } from "@/lib/prisma";
import {
  uploadRecipeImage,
  deleteRecipeImage,
  getPublicUrl,
  RECIPE_IMAGES_BUCKET,
} from "@/lib/storage/recipe-images";
import type { Tool } from "./types";

const inputSchema = z.object({
  recipeId: z.string().min(1),
  promptDescription: z.string().max(500).optional(),
  confirmed: z.boolean().optional(),
  askFirst: z.boolean().optional(),
});

type Input = z.infer<typeof inputSchema>;

let clientOverride: Pick<GoogleGenAI, "models"> | null = null;

/**
 * Set an override for the Google Gen AI client (used for mocking during tests).
 */
export function setGoogleGenAIClientForTest(client: Pick<GoogleGenAI, "models"> | null) {
  clientOverride = client;
}

export const generateRecipeImage: Tool<
  typeof inputSchema,
  { id: string; imageUrl: string }
> = {
  name: "generateRecipeImage",
  description:
    "Generate a professional, beautiful recipe image using AI. Pass recipeId, and optionally promptDescription. Call this when a recipe is created/imported without an image, or when explicitly asked.",
  inputSchema,
  statusKey: "recipe.generatingImage",
  requiresFeature: "aiChat",
  async requiresConfirmation(input) {
    if (input.askFirst && !input.confirmed) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: input.recipeId },
        select: { title: true },
      });
      const name = recipe?.title ?? "this recipe";
      return {
        message: name,
        payload: {
          ...input,
          confirmed: true,
        },
      };
    }
    return null;
  },
  async execute(input: Input, ctx, emit) {
    if (input.askFirst && !input.confirmed) {
      return {
        ok: false,
        reason: "generic",
        message: "Image generation requires confirmation",
      };
    }
    const { recipeId, promptDescription } = input;

    // 1. Verify recipe exists and ownership
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { id: true, userId: true, title: true, description: true, imageUrl: true },
    });

    if (!recipe) {
      return {
        ok: false,
        reason: "notFound",
        message: "Recipe not found",
      };
    }

    if (recipe.userId !== ctx.userId) {
      return {
        ok: false,
        reason: "unauthorized",
        message: "You are not authorized to update this recipe image",
      };
    }

    // 2. Initialize Google Gen AI client
    let client: Pick<GoogleGenAI, "models">;
    if (clientOverride) {
      client = clientOverride;
    } else {
      const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
      const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";

      if (!project) {
        return {
          ok: false,
          reason: "generic",
          message: "GOOGLE_CLOUD_PROJECT_ID is not configured in the environment.",
        };
      }

      client = new GoogleGenAI({
        vertexai: true,
        project,
        location,
      });
    }

    // 3. Formulate premium prompt
    const baseDescription = promptDescription || recipe.description || recipe.title;
    const prompt = `Premium professional food photography of ${recipe.title}. ${baseDescription}. Served on a matching high-end dish, beautiful lighting, shot at 45 degree angle, shallow depth of field, appetizing, delicious, clean composition, high-end culinary plating style.`;

    emit?.({ statusKey: "recipe.generatingImage" });

    // 4. Generate image using Imagen 3
    let response;
    try {
      response = await client.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: "4:3",
          outputMimeType: "image/jpeg",
          negativePrompt:
            "text, watermark, logo, cartoon, drawing, illustration, blurry, low resolution, overhead shot, messy plate, hands, person",
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: "generic",
        message: `Google Imagen generation failed: ${msg}`,
      };
    }

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      return {
        ok: false,
        reason: "generic",
        message: "Google Imagen did not return any image data.",
      };
    }

    // 5. Convert base64 base bytes and optimize with Sharp
    const buffer = Buffer.from(imageBytes, "base64");
    let optimizedBytes: Buffer;
    try {
      optimizedBytes = await sharp(buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: "generic",
        message: `Image optimization failed: ${msg}`,
      };
    }

    const imageUuid = randomUUID();
    const storagePath = `recipes/${recipeId}/${imageUuid}.jpg`;

    // 6. Delete old image from Supabase public storage bucket if it exists
    if (recipe.imageUrl) {
      const marker = `/storage/v1/object/public/${RECIPE_IMAGES_BUCKET}/`;
      const index = recipe.imageUrl.indexOf(marker);
      if (index !== -1) {
        const oldPath = recipe.imageUrl.slice(index + marker.length);
        try {
          await deleteRecipeImage(oldPath);
        } catch (err) {
          console.warn(`[generateRecipeImage] Could not delete old image ${oldPath}:`, err);
        }
      }
    }

    // 7. Upload optimized image to Supabase
    try {
      await uploadRecipeImage(storagePath, optimizedBytes, "image/jpeg");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        reason: "generic",
        message: `Supabase Storage upload failed: ${msg}`,
      };
    }

    const publicUrl = getPublicUrl(storagePath);

    // 8. Persist the image URL to the database
    try {
      await prisma.recipe.update({
        where: { id: recipeId },
        data: { imageUrl: publicUrl },
      });
    } catch (dbErr) {
      // Cleanup to prevent orphaned storage assets
      try {
        await deleteRecipeImage(storagePath);
      } catch (cleanupErr) {
        console.error(
          "[generateRecipeImage] Cleanup of orphaned upload failed",
          cleanupErr
        );
      }
      return {
        ok: false,
        reason: "generic",
        message: "Failed to persist image URL to the database.",
      };
    }

    return {
      ok: true,
      data: { id: recipeId, imageUrl: publicUrl },
      link: {
        type: "recipe",
        href: `/recipes/${recipeId}`,
        label: recipe.title,
      },
    };
  },
};
