import { z } from "zod";

import { persistRecipe } from "@/actions/recipe";
import prisma from "@/lib/prisma";
import {
  GemmaExtractionError,
  getGemmaProvider,
  setGemmaProviderForTest,
} from "@/lib/chat/llm-gemma";
import {
  MULTIMODAL_DAILY_CAP,
  getMultimodalImportCountToday,
} from "@/lib/chat/multimodal-cap";
import { downloadBytes } from "@/lib/storage/chat-recipe-media";
import type { ImportedRecipeData } from "@/lib/ingest/imported-recipe-schema";
import type { Tool } from "./types";

/**
 * Tool: importRecipeFromImage (DIE-41).
 *
 * Image-based recipe import. Mirrors importRecipeFromUrl's contract — same
 * tool.completed { link } shape, same downstream pipeline (Edamam analysis +
 * persistRecipe) — but the extraction front-end is Gemma 4 31B via the Gemini
 * API instead of Supadata.
 *
 * The LLM calls this with an `eventId` it reads from the marker we inject
 * into the user message in /api/chat/route.ts:
 *   [attachment kind=image eventId=<uuid>]
 *
 * The eventId resolves to a MultimodalImportEvent row created by
 * /api/chat/upload. The tool re-validates ownership defensively, fetches the
 * bytes from Supabase Storage, runs Gemma, and persists. Failure reasons map
 * one-to-one to i18n keys under chat.toolError.extraction.* so the user sees
 * a specific message ("the photo is blurry" vs "no recipe detected").
 */

const inputSchema = z.object({
  eventId: z.string().uuid(),
});

type Input = z.infer<typeof inputSchema>;

export type ImageImportFailureReason =
  | "cost-cap-day"
  | "event-not-found"
  | "event-forbidden"
  | "event-deleted"
  | "no-ingredients"
  | "low-quality"
  | "unsupported-format"
  | "schema-mismatch"
  | "transient"
  | "persist-failed";

interface ImageImportFailureLog {
  eventId: string;
  reason: ImageImportFailureReason;
  detail?: string;
  createdAt: string;
}

function logImageImportFailure(failure: ImageImportFailureLog): void {
  // Same telemetry pattern as importRecipeFromUrl. stdout for v1.
  console.warn("[importRecipeFromImage] ImageImportFailure", failure);
}

// Re-exported for tests that import the hook from this module's path.
export { setGemmaProviderForTest };

function mapGemmaErrorReason(
  reason: GemmaExtractionError["reason"]
): ImageImportFailureReason {
  switch (reason) {
    case "no-ingredients":
      return "no-ingredients";
    case "low-quality":
      return "low-quality";
    case "unsupported-format":
      return "unsupported-format";
    case "schema-mismatch":
      return "schema-mismatch";
    case "transient":
      return "transient";
  }
}

/** Translate the lenient `ImportedRecipeData` into `RecipeFormData` shape with
 * defaults persistRecipe expects. Mirrors the URL importer's mapping. */
function toRecipeFormData(imported: ImportedRecipeData) {
  return {
    title: imported.title,
    description: imported.description,
    prepTime: imported.prepTime,
    cookTime: imported.cookTime,
    servings: imported.servings ?? 2,
    difficulty: imported.difficulty,
    ingredients: imported.ingredients,
    instructions:
      imported.instructions.length > 0
        ? imported.instructions
        : ["Refer to the original image."],
    tags: imported.tags ?? [],
    categoryIds: [] as string[],
    isPublic: false,
    // Intentionally leave Recipe.imageUrl undefined: the chat-recipe-media
    // bucket entry is auto-deleted after 7 days, so pointing the persisted
    // recipe at it would break the image after the retention window. The user
    // can edit the recipe to add an image later.
  };
}

export const importRecipeFromImage: Tool<
  typeof inputSchema,
  { id: string; title: string }
> = {
  name: "importRecipeFromImage",
  description:
    "Extract and save a recipe from an image the user has attached to their message. Look for an [attachment kind=image eventId=<uuid>] marker in the most recent user message and pass that uuid as eventId. Returns a link to the saved recipe.",
  guidance: `IMAGE ATTACHMENTS — importRecipeFromImage.
- When the user attaches an image (a recipe photo, cookbook page, screenshot, chalkboard, handwritten note), the runtime injects a marker into the user message of the form:
    [attachment kind=image eventId=<uuid>]
- Each marker is one attachment. When you see one, call importRecipeFromImage({ eventId }) with the uuid exactly as written. Do not invent eventIds.
- The tool extracts a recipe via Gemma 4, runs nutrition analysis, and saves it — exactly like importRecipeFromUrl. The runtime attaches the link automatically.
- If the image is clearly NOT a recipe (selfie, landscape, food product label without instructions), let the tool fail and acknowledge briefly that you couldn't extract a recipe. Do not try to describe the image in prose.`,
  inputSchema,
  statusKey: "media.extracting",
  requiresFeature: "aiChat",
  async execute(input: Input, ctx, emit) {
    const { eventId } = input;

    // Step 0: Load the event row. The LLM may have hallucinated an eventId
    // that doesn't exist or belongs to another user — validate defensively.
    const event = await prisma.multimodalImportEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        userId: true,
        mediaPath: true,
        mimeType: true,
        outcome: true,
        deletedAt: true,
      },
    });

    if (!event) {
      logImageImportFailure({
        eventId,
        reason: "event-not-found",
        createdAt: new Date().toISOString(),
      });
      return {
        ok: false,
        reason: "notFound",
        message: "extraction-failed: event-not-found",
      };
    }

    if (event.userId !== ctx.userId) {
      logImageImportFailure({
        eventId,
        reason: "event-forbidden",
        createdAt: new Date().toISOString(),
      });
      return {
        ok: false,
        reason: "unauthorized",
        message: "extraction-failed: event-forbidden",
      };
    }

    if (event.deletedAt) {
      logImageImportFailure({
        eventId,
        reason: "event-deleted",
        createdAt: new Date().toISOString(),
      });
      return {
        ok: false,
        reason: "notFound",
        message: "extraction-failed: event-deleted",
      };
    }

    // Step 1: Daily cap. Pending event already counts (it was created at
    // upload), but the LLM may invoke this tool more than once per turn —
    // re-check at execute time. Cap = 10 attempts / UTC calendar day.
    const todayCount = await getMultimodalImportCountToday(prisma, ctx.userId);
    if (todayCount > MULTIMODAL_DAILY_CAP) {
      logImageImportFailure({
        eventId,
        reason: "cost-cap-day",
        detail: `${todayCount}/${MULTIMODAL_DAILY_CAP}`,
        createdAt: new Date().toISOString(),
      });
      await prisma.multimodalImportEvent.update({
        where: { id: eventId },
        data: { outcome: "failure", reason: "cost-cap-day", processedAt: new Date() },
      });
      return {
        ok: false,
        reason: "quota",
        message: "extraction-failed: cost-cap-day",
      };
    }

    // Step 2: Download bytes from Supabase Storage.
    let bytes: Uint8Array;
    try {
      bytes = await downloadBytes(event.mediaPath);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      logImageImportFailure({
        eventId,
        reason: "transient",
        detail,
        createdAt: new Date().toISOString(),
      });
      await prisma.multimodalImportEvent.update({
        where: { id: eventId },
        data: { outcome: "failure", reason: "transient", processedAt: new Date() },
      });
      return {
        ok: false,
        reason: "generic",
        message: "extraction-failed: storage-download",
      };
    }

    // Step 3: Extract via Gemma. The provider throws GemmaExtractionError with
    // a reason; we re-emit media.extracting first so the FE updates immediately.
    emit?.({ statusKey: "media.extracting" });

    let imported: ImportedRecipeData;
    try {
      imported = await getGemmaProvider().extractRecipe({
        imageBytes: bytes,
        mimeType: event.mimeType,
        locale: ctx.locale,
      });
    } catch (err) {
      if (err instanceof GemmaExtractionError) {
        const mappedReason = mapGemmaErrorReason(err.reason);
        logImageImportFailure({
          eventId,
          reason: mappedReason,
          detail: err.message,
          createdAt: new Date().toISOString(),
        });
        await prisma.multimodalImportEvent.update({
          where: { id: eventId },
          data: {
            outcome: "failure",
            reason: mappedReason,
            processedAt: new Date(),
          },
        });
        return {
          ok: false,
          reason: mappedReason === "low-quality" ? "notFound" : "generic",
          message: `extraction-failed: ${mappedReason}`,
        };
      }
      const detail = err instanceof Error ? err.message : String(err);
      logImageImportFailure({
        eventId,
        reason: "transient",
        detail,
        createdAt: new Date().toISOString(),
      });
      await prisma.multimodalImportEvent.update({
        where: { id: eventId },
        data: { outcome: "failure", reason: "transient", processedAt: new Date() },
      });
      return {
        ok: false,
        reason: "generic",
        message: "extraction-failed: transient",
      };
    }

    // Step 4: Persist. Mirror URL importer flow — persistRecipe enforces
    // recipeImport entitlement, tags "imported", and runs Edamam analysis.
    emit?.({ statusKey: "import.analyzing" });
    emit?.({ statusKey: "import.saving" });

    const persisted = await persistRecipe(toRecipeFormData(imported), {
      source: "imported",
      importedFrom: "image",
      sourceUrl: event.mediaPath,
      locale: ctx.locale,
    });

    if (persisted.error || !persisted.data) {
      const code =
        persisted.error &&
        typeof persisted.error === "object" &&
        "code" in persisted.error
          ? (persisted.error as { code: string }).code
          : "GENERIC";
      logImageImportFailure({
        eventId,
        reason: "persist-failed",
        detail: code,
        createdAt: new Date().toISOString(),
      });
      await prisma.multimodalImportEvent.update({
        where: { id: eventId },
        data: { outcome: "failure", reason: "persist-failed", processedAt: new Date() },
      });
      const reason: "unauthorized" | "quota" | "generic" =
        code === "PRO_ONLY"
          ? "unauthorized"
          : code === "QUOTA_EXCEEDED"
            ? "quota"
            : "generic";
      return {
        ok: false,
        reason,
        message:
          typeof persisted.error === "string"
            ? persisted.error
            : "Could not save the imported recipe",
      };
    }

    // Step 5: Record success. Link the event to the resulting recipe so we
    // have a back-pointer for audit + retention-based cleanup later.
    await prisma.multimodalImportEvent.update({
      where: { id: eventId },
      data: {
        outcome: "success",
        recipeId: persisted.data.id,
        processedAt: new Date(),
      },
    });

    return {
      ok: true,
      data: { id: persisted.data.id, title: persisted.data.title },
      link: {
        type: "recipe",
        href: `/recipes/${persisted.data.id}`,
        label: persisted.data.title,
      },
    };
  },
};
