import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { assertCanImportRecipe } from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import { buildStoragePath, uploadImage } from "@/lib/storage/chat-recipe-media";
import {
  MULTIMODAL_DAILY_CAP,
  getMultimodalImportCountToday,
} from "@/lib/chat/multimodal-cap";
import { GemmaExtractionError, getGemmaProvider } from "@/lib/chat/llm-gemma";
import type { Locale } from "@/lib/chat/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recipe import from a photo or PDF — modal entry point. Mirrors the chat tool
// `importRecipeFromImage`: extraction runs through Gemma (Gemini) via
// `getGemmaProvider().extractRecipe`, sharing the same daily cap and storage
// (MultimodalImportEvent + chat-recipe-media bucket, 7-day retention).
//
// Unlike the chat tool, this route extracts synchronously and returns the
// recipe so the modal can prefill the form; persistence happens later through
// the normal create flow (form submit), which re-checks entitlement and tags
// the recipe as imported. PDFs are passed straight to Gemini (which reads PDF
// natively) — the sharp/HEIC conversion path is image-only.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif", // some browsers report HEIC as image/heif
  "application/pdf",
]);

const VALID_LOCALES: ReadonlySet<string> = new Set(["en", "es", "pl"]);

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
    case "application/pdf":
      return "pdf";
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
    await assertCanImportRecipe(user);
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

  // Daily cost guard — shared with the chat image importer. Block before
  // spending any Gemini tokens. Cap = attempts / UTC calendar day.
  const todayCount = await getMultimodalImportCountToday(prisma, user.id);
  if (todayCount >= MULTIMODAL_DAILY_CAP) {
    return jsonError(429, "daily-cap", "Daily import limit reached. Try again tomorrow");
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
      `File exceeds ${MAX_BYTES / (1024 * 1024)} MB limit`
    );
  }

  const incomingType = file.type.toLowerCase();
  if (!ALLOWED_MIME.has(incomingType)) {
    return jsonError(
      415,
      "unsupported-format",
      `Unsupported file type ${file.type}. Use JPEG, PNG, WebP, HEIC, or PDF.`
    );
  }

  const localeRaw = form.get("locale");
  const locale: Locale = VALID_LOCALES.has(String(localeRaw))
    ? (String(localeRaw) as Locale)
    : "en";

  const originalBytes = Buffer.from(await file.arrayBuffer());

  // HEIC -> JPEG conversion (iOS Safari often uploads .HEIC). PDFs and the
  // supported web image formats pass through untouched — Gemini reads them.
  let storedBytes: Buffer = originalBytes;
  let storedMime = incomingType;
  if (incomingType === "image/heic" || incomingType === "image/heif") {
    try {
      storedBytes = await sharp(originalBytes).jpeg({ quality: 85 }).toBuffer();
      storedMime = "image/jpeg";
    } catch (err) {
      console.error("[recipes/import/image] HEIC conversion failed", err);
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
    console.error("[recipes/import/image] storage upload failed", err);
    return jsonError(502, "storage-upload-failed", "Could not store the file");
  }

  // Record the attempt for cost accounting + retention cleanup. Counted by the
  // daily cap regardless of outcome. `outcome` here reflects EXTRACTION, not
  // persistence — the recipe is saved later via the form submit.
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

  try {
    const recipe = await getGemmaProvider().extractRecipe({
      imageBytes: storedBytes,
      mimeType: storedMime,
      locale,
    });

    await prisma.multimodalImportEvent.update({
      where: { id: eventId },
      data: { outcome: "success", processedAt: new Date() },
    });

    return new Response(JSON.stringify({ recipe, eventId }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const reason = err instanceof GemmaExtractionError ? err.reason : "transient";
    console.warn("[recipes/import/image] extraction failed", reason, err instanceof Error ? err.message : err);
    await prisma.multimodalImportEvent.update({
      where: { id: eventId },
      data: { outcome: "failure", reason, processedAt: new Date() },
    });

    if (reason === "no-ingredients" || reason === "low-quality") {
      return jsonError(422, "no-recipe", "No recipe could be read from that file");
    }
    if (reason === "unsupported-format") {
      return jsonError(415, "unsupported-format", "That file format could not be read");
    }
    return jsonError(502, "extraction-failed", "Could not read that file. Try again");
  }
}
