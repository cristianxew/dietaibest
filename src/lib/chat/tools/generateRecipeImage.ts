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
import { buildGenAIVertexOptions } from "./genai-options";

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
  { id: string; imageUrl: string; skippedExistingImage?: boolean; note?: string }
> = {
  name: "generateRecipeImage",
  description:
    "Generate a professional, beautiful recipe image using AI. Pass recipeId, and optionally promptDescription. Call this when a recipe is created/imported without an image, or when explicitly asked.",
  guidance: `IMAGE GENERATION — generateRecipeImage.
- When a recipe has just been created or imported WITHOUT an image, or when the user explicitly asks to generate an image for a recipe, you MUST call generateRecipeImage to create a beautiful 4:3 food photography image for that recipe.
- When the user EXPLICITLY asks to generate or regenerate an image, call generateRecipeImage with askFirst: false — even if the recipe already has one; an explicit request replaces the existing image. askFirst: true is ONLY for the post-import auto-offer.
- If a recipe was just created FROM SCRATCH, immediately trigger generateRecipeImage with askFirst: false as a subsequent tool call in the same turn, using the recipe's returned ID. Do NOT wait for the user to ask.
- If a recipe was just IMPORTED (from a URL or image attachment): check the import result's hasImage field. ONLY when hasImage is false, immediately trigger generateRecipeImage with askFirst: true as a subsequent tool call in the same turn (this gates the generation behind a user confirmation prompt). When hasImage is true the recipe already has a photo from the source — do NOT call generateRecipeImage and do NOT offer it unless the user explicitly asks for a new image.
- Only call generateRecipeImage for existing recipes (it requires a recipeId). If the user asks to generate an image but no recipe is loaded/active in context, search for it using searchRecipes or ask for clarification first.`,
  inputSchema,
  statusKey: "recipe.generatingImage",
  requiresFeature: "aiChat",
  async requiresConfirmation(input) {
    if (input.askFirst && !input.confirmed) {
      const recipe = await prisma.recipe.findUnique({
        where: { id: input.recipeId },
        select: { title: true, imageUrl: true },
      });
      // Auto-offer guard (deterministic backstop for the guidance): the source
      // already provided a photo — nothing to ask. execute() no-ops for the
      // same condition, so the model just gets a "skipped" result to ack.
      if (recipe?.imageUrl) return null;
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

    if (input.askFirst && !input.confirmed) {
      // Mirror of the requiresConfirmation auto-offer guard: an unconfirmed
      // gated call on a recipe that already has an image is a graceful no-op,
      // not a generation. Explicit confirmation (confirmed: true) regenerates.
      if (recipe.imageUrl) {
        return {
          ok: true,
          data: {
            id: recipe.id,
            imageUrl: recipe.imageUrl,
            skippedExistingImage: true,
            // Spells out for the model that NOTHING was generated, so it never
            // narrates this as a success — and how to honour an explicit
            // regeneration request.
            note: "The recipe already has an image, so generation was SKIPPED — do not tell the user an image was generated. If the user explicitly asked for a new image, call generateRecipeImage again with askFirst: false to replace it.",
          },
          link: {
            type: "recipe",
            href: `/recipes/${recipe.id}`,
            label: recipe.title,
          },
        };
      }
      return {
        ok: false,
        reason: "generic",
        message: "Image generation requires confirmation",
      };
    }

    // 2. Initialize Google Gen AI client
    let client: Pick<GoogleGenAI, "models">;
    if (clientOverride) {
      client = clientOverride;
    } else {
      // Reuse the Document AI service-account key file (GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH)
      // for Vertex auth. Without it the SDK falls back to ADC → the GCP metadata
      // server, which doesn't exist off-GCP (our VPS) → "All promises were rejected".
      const options = buildGenAIVertexOptions(process.env);
      if (!options) {
        console.error(
          "[generateRecipeImage] misconfigured:",
          "GOOGLE_CLOUD_PROJECT_ID is not set"
        );
        return {
          ok: false,
          reason: "generic",
          message: "GOOGLE_CLOUD_PROJECT_ID is not configured in the environment.",
        };
      }

      client = new GoogleGenAI(options);
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
      // Failure messages only travel to the model as tool results — log them
      // so production failures (auth, quota, retired model) hit the container
      // logs too.
      console.error("[generateRecipeImage] Imagen call failed:", msg);
      return {
        ok: false,
        reason: "generic",
        message: `Google Imagen generation failed: ${msg}`,
      };
    }

    const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!imageBytes) {
      console.error(
        "[generateRecipeImage] Imagen returned no image data:",
        JSON.stringify(response.generatedImages ?? null)?.slice(0, 300)
      );
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
      console.error("[generateRecipeImage] sharp optimization failed:", msg);
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
      console.error("[generateRecipeImage] storage upload failed:", msg);
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
      console.error("[generateRecipeImage] DB persist of imageUrl failed:", dbErr);
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
