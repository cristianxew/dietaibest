import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import {
  uploadRecipeImage,
  deleteRecipeImage,
  getPublicUrl,
  RECIPE_IMAGES_BUCKET,
} from "@/lib/storage/recipe-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return jsonError(401, "unauthorized", "Sign-in required");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return jsonError(404, "user-not-found", "User not found");
  }

  const { id: recipeId } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { userId: true, imageUrl: true },
  });
  if (!recipe) {
    return jsonError(404, "recipe-not-found", "Recipe not found");
  }

  if (recipe.userId !== user.id) {
    return jsonError(403, "forbidden", "Only the owner can update the recipe image");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError(400, "invalid-form", "Expected multipart/form-data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError(400, "missing-file", "Missing 'file' field");
  }

  if (file.size > MAX_BYTES) {
    return jsonError(
      413,
      "file-too-large",
      `Image exceeds ${MAX_BYTES / (1024 * 1024)} MB limit`
    );
  }

  const incomingType = file.type.toLowerCase();
  if (!ALLOWED_MIME.has(incomingType)) {
    return jsonError(
      415,
      "unsupported-format",
      `Unsupported MIME ${file.type}. Use JPEG, PNG, WebP, or HEIC.`
    );
  }

  const originalBytes = Buffer.from(await file.arrayBuffer());
  let optimizedBytes: Buffer;

  try {
    optimizedBytes = await sharp(originalBytes)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.error("[recipes/image] Image optimization failed", err);
    return jsonError(
      500,
      "optimization-failed",
      "Could not optimize image. Try uploading a different format."
    );
  }

  const imageUuid = randomUUID();
  const storagePath = `recipes/${recipeId}/${imageUuid}.jpg`;

  // 1. Delete the previous image from the bucket if it exists in the Supabase public storage bucket
  if (recipe.imageUrl) {
    const marker = `/storage/v1/object/public/${RECIPE_IMAGES_BUCKET}/`;
    const index = recipe.imageUrl.indexOf(marker);
    if (index !== -1) {
      const oldPath = recipe.imageUrl.slice(index + marker.length);
      try {
        await deleteRecipeImage(oldPath);
      } catch (err) {
        console.warn(`[recipes/image] Could not delete old image ${oldPath}:`, err);
      }
    }
  }

  // 2. Upload the new optimized image
  try {
    await uploadRecipeImage(storagePath, optimizedBytes, "image/jpeg");
  } catch (err) {
    console.error("[recipes/image] Supabase Storage upload failed", err);
    return jsonError(502, "storage-upload-failed", "Could not store recipe image");
  }

  // 3. Get public URL of the uploaded image
  const publicUrl = getPublicUrl(storagePath);

  // 4. Persist the new public URL in Prisma database
  try {
    await prisma.recipe.update({
      where: { id: recipeId },
      data: { imageUrl: publicUrl },
    });
  } catch (err) {
    console.error("[recipes/image] Database persist failed", err);
    // Cleanup the uploaded image if db update fails to prevent orphans
    try {
      await deleteRecipeImage(storagePath);
    } catch (cleanupErr) {
      console.error("[recipes/image] Cleanup of orphaned upload failed", cleanupErr);
    }
    return jsonError(500, "db-update-failed", "Could not save image URL to database");
  }

  return new Response(
    JSON.stringify({ imageUrl: publicUrl }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return jsonError(401, "unauthorized", "Sign-in required");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return jsonError(404, "user-not-found", "User not found");
  }

  const { id: recipeId } = await params;

  const recipe = await prisma.recipe.findUnique({
    where: { id: recipeId },
    select: { userId: true, imageUrl: true },
  });
  if (!recipe) {
    return jsonError(404, "recipe-not-found", "Recipe not found");
  }

  if (recipe.userId !== user.id) {
    return jsonError(403, "forbidden", "Only the owner can delete the recipe image");
  }

  // Delete the image from the bucket if it exists
  if (recipe.imageUrl) {
    const marker = `/storage/v1/object/public/${RECIPE_IMAGES_BUCKET}/`;
    const index = recipe.imageUrl.indexOf(marker);
    if (index !== -1) {
      const oldPath = recipe.imageUrl.slice(index + marker.length);
      try {
        await deleteRecipeImage(oldPath);
      } catch (err) {
        console.warn(`[recipes/image] Could not delete old image ${oldPath}:`, err);
      }
    }
  }

  // Persist the null imageUrl in database
  try {
    await prisma.recipe.update({
      where: { id: recipeId },
      data: { imageUrl: null },
    });
  } catch (err) {
    console.error("[recipes/image] Database persist failed", err);
    return jsonError(500, "db-update-failed", "Could not remove image URL from database");
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

