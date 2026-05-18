import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { assertCanUseAiChat } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import {
  buildStoragePath,
  uploadImage,
} from "@/lib/storage/chat-recipe-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DIE-41 — Upload endpoint for the chat agent's image attachments.
// Multipart POST with a single "file" field. Returns { mediaRef, eventId }
// that the FE attaches to the next user message; the chat agent's
// importRecipeFromImage tool resolves mediaRef back into bytes via the
// storage helper and runs Gemma extraction.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif", // some browsers report HEIC as image/heif
]);

function extensionFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
    case "image/heif":
      return "heic";
    default:
      return "bin";
  }
}

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
    select: { id: true, plan: true, subscriptionStatus: true },
  });
  if (!user) {
    return jsonError(404, "user-not-found", "User not found");
  }

  try {
    await assertCanUseAiChat(user);
  } catch (err) {
    const payload = toEntitlementError(err);
    if (payload) {
      return new Response(JSON.stringify({ error: payload }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
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

  // HEIC -> JPEG conversion. iOS Safari often uploads .HEIC even when the user
  // picked a "photo" — browsers can't render HEIC natively for the chat preview
  // and Gemma may not accept it directly, so we normalize to JPEG server-side.
  let storedBytes: Buffer = originalBytes;
  let storedMime = incomingType;
  if (incomingType === "image/heic" || incomingType === "image/heif") {
    try {
      storedBytes = await sharp(originalBytes).jpeg({ quality: 85 }).toBuffer();
      storedMime = "image/jpeg";
    } catch (err) {
      console.error("[chat/upload] HEIC conversion failed", err);
      return jsonError(
        500,
        "heic-conversion-failed",
        "Could not convert HEIC image. Try saving as JPEG."
      );
    }
  }

  const eventId = randomUUID();
  const ext = extensionFromMime(storedMime);
  const path = buildStoragePath({ userId: user.id, eventId, extension: ext });

  try {
    await uploadImage({ path, body: storedBytes, contentType: storedMime });
  } catch (err) {
    console.error("[chat/upload] storage upload failed", err);
    return jsonError(502, "storage-upload-failed", "Could not store image");
  }

  await prisma.multimodalImportEvent.create({
    data: {
      id: eventId,
      userId: user.id,
      kind: "image",
      mediaPath: path,
      mimeType: storedMime,
      sizeBytes: storedBytes.byteLength,
      outcome: "pending",
    },
  });

  return new Response(
    JSON.stringify({
      mediaRef: path,
      eventId,
      kind: "image",
      mimeType: storedMime,
      sizeBytes: storedBytes.byteLength,
    }),
    { status: 201, headers: { "Content-Type": "application/json" } }
  );
}
