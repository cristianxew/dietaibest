import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { uploadRecipeImage, getPublicUrl } from "@/lib/storage/recipe-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generic recipe-photo upload — used by the create/edit modal where the recipe
// may not exist yet (no id). Optimizes the file (same sharp pipeline as
// /api/recipes/[id]/image) and returns a public URL; the form drops it into
// `imageUrl` and the normal save persists it. Auth-only (no entitlement gate),
// matching the [id]/image route. Files land under recipes/_uploads/{userId}/.

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

export async function POST(req: NextRequest) {
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
    console.error("[recipes/image-upload] optimization failed", err);
    return jsonError(
      500,
      "optimization-failed",
      "Could not optimize image. Try a different format."
    );
  }

  const storagePath = `recipes/_uploads/${user.id}/${randomUUID()}.jpg`;
  try {
    await uploadRecipeImage(storagePath, optimizedBytes, "image/jpeg");
  } catch (err) {
    console.error("[recipes/image-upload] storage upload failed", err);
    return jsonError(502, "storage-upload-failed", "Could not store the image");
  }

  return new Response(JSON.stringify({ imageUrl: getPublicUrl(storagePath) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
