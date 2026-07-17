import { z } from "zod";

import { persistRecipe } from "@/actions/recipe";
import {
  selectIngestStrategy,
  type IngestStrategy,
} from "@/lib/chat/ingestion/select-strategy";
import { SupadataError } from "@/lib/supadata";
import { GemmaExtractionError } from "@/lib/chat/llm-gemma";
import { extractRecipe } from "@/lib/ingest/extract-recipe";
import { canonicalizeRecipeUrl } from "@/lib/ingest/canonicalize-url";
import {
  findExistingImport,
  recipeRowToImported,
} from "@/lib/ingest/recipe-dedup";
import { importedRecipeSchema } from "@/lib/ingest/imported-recipe-schema";
import type { ImportedRecipe } from "@/types/recipe";
import type { AgentContext } from "../context";
import { ToolFailure, type ConfirmDescriptor, type Tool } from "./types";

/**
 * Tool: importRecipeFromUrl.
 *
 * Two-phase:
 *  - requiresConfirmation(): routes the URL through Supadata, extracts a
 *    structured recipe (web -> /web/scrape + Gemma; video -> /extract), and
 *    returns a preview descriptor whose payload carries the recipe. Any failure
 *    throws ToolFailure -> the runtime emits tool.failed.
 *  - execute(): runs only after the user confirms; persists input.recipe with
 *    NO re-extraction.
 */

const inputSchema = z.object({
  url: z.string().url(),
  hint: z.string().max(200).optional(),
  confirmed: z.boolean().optional(),
  recipe: importedRecipeSchema.optional(),
  // Rides the confirmation payload when the preview was cloned from an
  // existing import of the same canonical URL (see recipe-dedup).
  dedupSourceRecipeId: z.string().optional(),
});

type Input = z.infer<typeof inputSchema>;

export type ImportFailureReason =
  | "ingest-failed"
  | "no-ingredients"
  | "no-recipe-data"
  | "persist-failed"
  | "invalid-url";

interface ImportFailureLog {
  host: string | null;
  strategy: IngestStrategy | "unknown";
  errorReason: ImportFailureReason;
  errorCode?: string;
  status?: number;
  /**
   * Upstream provider message (e.g. Supadata's "Rate limit exceeded" vs
   * "Monthly quota exceeded"). Without it a 429 is ambiguous in the logs.
   */
  errorMessage?: string;
  createdAt: string;
}

function logImportFailure(failure: ImportFailureLog): void {
  console.warn("[importRecipeFromUrl] ImportFailure", failure);
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export const importRecipeFromUrl: Tool<
  typeof inputSchema,
  { id: string; title: string; hasImage: boolean; alreadyImported?: boolean }
> = {
  name: "importRecipeFromUrl",
  description:
    "Import a recipe from a URL (YouTube, TikTok, Instagram, Facebook, X, or a recipe website) and save it to the user's library. The user is shown a preview to confirm before it is saved. Returns a link to the saved recipe.",
  guidance:
    "If the result contains `alreadyImported: true`, the user had already imported this exact URL — tell them so in their language and point them to the linked recipe; do NOT retry the import or create a duplicate.",
  inputSchema,
  statusKey: "import.fetching",
  requiresFeature: "aiChat",

  async requiresConfirmation(
    input: Input,
    ctx: AgentContext
  ): Promise<ConfirmDescriptor | null> {
    // Resume path: the recipe was already previewed + confirmed.
    if (input.confirmed) return null;

    const { url } = input;
    const host = safeHost(url);

    let strategy: IngestStrategy;
    try {
      strategy = selectIngestStrategy(url);
    } catch {
      logImportFailure({
        host,
        strategy: "unknown",
        errorReason: "invalid-url",
        createdAt: new Date().toISOString(),
      });
      throw new ToolFailure("generic", "ingest-failed: invalid-url");
    }

    // Import dedup — a canonical-URL hit answers without touching Supadata.
    // Own import → no preview at all: execute() short-circuits with
    // alreadyImported (the null return means "no confirmation needed", same
    // contract as generateRecipeImage's auto-offer guard). Someone else's →
    // serve its content as the preview; persistRecipe may copy its nutrition.
    const canonicalUrl = canonicalizeRecipeUrl(url);
    if (canonicalUrl) {
      const match = await findExistingImport(canonicalUrl, ctx.userId);
      if (match?.kind === "own") return null;
      if (match?.kind === "other") {
        const imported = recipeRowToImported(match.recipe, url);
        return {
          message: imported.title,
          payload: {
            url,
            hint: input.hint,
            confirmed: true,
            recipe: imported,
            dedupSourceRecipeId: match.recipe.id,
          },
        };
      }
    }

    let imported: ImportedRecipe;
    try {
      imported = await extractRecipe(strategy, url, ctx.locale);
    } catch (error) {
      if (error instanceof GemmaExtractionError) {
        logImportFailure({
          host,
          strategy,
          errorReason: "no-ingredients",
          errorCode: error.reason,
          createdAt: new Date().toISOString(),
        });
        throw new ToolFailure("notFound", `ingest-failed: ${error.reason}`);
      }
      const errorCode = error instanceof SupadataError ? error.code : "UNKNOWN";
      const status = error instanceof SupadataError ? error.status : undefined;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logImportFailure({
        host,
        strategy,
        errorReason: "ingest-failed",
        errorCode,
        status,
        errorMessage,
        createdAt: new Date().toISOString(),
      });
      // 429 = the provider is rate-limiting us (not the user's plan quota).
      // Surface a distinct reason so the UI can say "try again shortly" rather
      // than a generic error or a misleading plan-quota message.
      const reason: ToolFailure["reason"] =
        status === 429 ? "rateLimited" : status === 404 ? "notFound" : "generic";
      throw new ToolFailure(reason, `ingest-failed: ${errorCode}`);
    }

    if (
      !imported.title ||
      imported.title.length < 3 ||
      imported.ingredients.length === 0
    ) {
      logImportFailure({
        host,
        strategy,
        errorReason: "no-ingredients",
        createdAt: new Date().toISOString(),
      });
      throw new ToolFailure("notFound", "ingest-failed: no-ingredients");
    }

    return {
      message: imported.title,
      payload: { url, hint: input.hint, confirmed: true, recipe: imported },
    };
  },

  async execute(input: Input, ctx) {
    const { url } = input;
    const host = safeHost(url);
    const imported = input.recipe;

    // Mirror of the requiresConfirmation own-import guard: when the user
    // already imported this exact URL, requiresConfirmation returned null (no
    // preview) and this call arrives without a recipe — answer with the
    // existing one instead of failing or duplicating. Also catches a re-import
    // that landed between preview and confirm.
    const canonicalUrl = canonicalizeRecipeUrl(url);
    if (canonicalUrl) {
      const own = await findExistingImport(canonicalUrl, ctx.userId);
      if (own?.kind === "own") {
        return {
          ok: true,
          data: {
            id: own.recipe.id,
            title: own.recipe.title,
            hasImage: Boolean(own.recipe.imageUrl),
            alreadyImported: true,
          },
          link: {
            type: "recipe",
            href: `/recipes/${own.recipe.id}`,
            label: own.recipe.title,
          },
        };
      }
    }

    if (!imported) {
      // Defensive: execute runs only after requiresConfirmation supplies a recipe.
      logImportFailure({
        host,
        strategy: "unknown",
        errorReason: "no-recipe-data",
        createdAt: new Date().toISOString(),
      });
      return {
        ok: false,
        reason: "generic",
        message: "ingest-failed: no-recipe-data",
      };
    }

    const strategy: IngestStrategy | "unknown" = (() => {
      try {
        return selectIngestStrategy(url);
      } catch {
        return "unknown";
      }
    })();

    const persisted = await persistRecipe(
      {
        title: imported.title,
        description: imported.description,
        prepTime: imported.prepTime,
        cookTime: imported.cookTime,
        servings: imported.servings ?? 2,
        ingredients: imported.ingredients,
        instructions:
          imported.instructions.length > 0
            ? imported.instructions
            : ["Refer to the source for preparation steps."],
        tags: imported.tags ?? [],
        categoryIds: [],
        isPublic: false,
        sourceUrl: imported.sourceUrl ?? url,
        imageUrl: imported.imageUrl,
      },
      {
        source: "url",
        sourceUrl: url,
        locale: ctx.locale,
        dedupSourceRecipeId: input.dedupSourceRecipeId,
      }
    );

    if (persisted.error || !persisted.data) {
      const code =
        persisted.error &&
        typeof persisted.error === "object" &&
        "code" in persisted.error
          ? (persisted.error as { code: string }).code
          : "GENERIC";
      logImportFailure({
        host,
        strategy,
        errorReason: "persist-failed",
        errorCode: code,
        createdAt: new Date().toISOString(),
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

    return {
      ok: true,
      data: {
        id: persisted.data.id,
        title: persisted.data.title,
        // Signal for the model's post-import decision: only offer
        // generateRecipeImage when the source did NOT provide a photo.
        hasImage: Boolean(imported.imageUrl),
      },
      link: {
        type: "recipe",
        href: `/recipes/${persisted.data.id}`,
        label: persisted.data.title,
      },
    };
  },
};
