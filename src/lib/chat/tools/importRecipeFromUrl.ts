import { z } from "zod";

import { persistRecipe } from "@/actions/recipe";
import {
  selectIngestStrategy,
  type IngestStrategy,
} from "@/lib/chat/ingestion/select-strategy";
import { getSupadataClient, SupadataError } from "@/lib/supadata";
import {
  GemmaExtractionError,
  getGemmaProvider,
} from "@/lib/chat/llm-gemma";
import { importedRecipeSchema } from "@/lib/ingest/imported-recipe-schema";
import type { ImportedRecipe } from "@/types/recipe";
import type { ScrapeResult } from "@/lib/supadata";
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

// Recipe JSON Schema sent to Supadata's /extract endpoint (video path only).
const RECIPE_EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    description: { type: "string" },
    prepTime: { type: "number" },
    cookTime: { type: "number" },
    servings: { type: "number" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          unit: { type: "string" },
        },
        required: ["name", "amount", "unit"],
      },
    },
    instructions: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    imageUrl: { type: "string" },
  },
  required: ["title", "ingredients", "instructions"],
} as const;

const inputSchema = z.object({
  url: z.string().url(),
  hint: z.string().max(200).optional(),
  confirmed: z.boolean().optional(),
  recipe: importedRecipeSchema.optional(),
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

function normaliseExtracted(
  data: Partial<ImportedRecipe> | null | undefined,
  sourceUrl: string
): ImportedRecipe {
  return {
    title: (data?.title ?? "").trim(),
    description: data?.description?.trim() || undefined,
    prepTime: data?.prepTime,
    cookTime: data?.cookTime,
    servings: data?.servings,
    ingredients: Array.isArray(data?.ingredients) ? data!.ingredients! : [],
    instructions: Array.isArray(data?.instructions) ? data!.instructions! : [],
    tags: Array.isArray(data?.tags) ? data!.tags! : [],
    imageUrl: data?.imageUrl,
    sourceUrl,
    extractedAt: new Date().toISOString(),
  };
}

/** Map a Gemma-extracted recipe + scrape metadata into the canonical shape. */
function mapScrapeToImported(
  data: {
    title: string;
    description?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    ingredients: ImportedRecipe["ingredients"];
    instructions: string[];
    tags?: string[];
    imageUrl?: string;
  },
  scrape: ScrapeResult,
  sourceUrl: string
): ImportedRecipe {
  return {
    title: (data.title || scrape.name || "").trim(),
    description: data.description?.trim() || scrape.description?.trim() || undefined,
    prepTime: data.prepTime,
    cookTime: data.cookTime,
    servings: data.servings,
    ingredients: data.ingredients,
    instructions: data.instructions,
    tags: data.tags ?? [],
    imageUrl: data.imageUrl || scrape.ogUrl || undefined,
    sourceUrl,
    extractedAt: new Date().toISOString(),
  };
}

async function extractRecipe(
  strategy: IngestStrategy,
  url: string,
  ctx: AgentContext
): Promise<ImportedRecipe> {
  const client = getSupadataClient();
  if (strategy === "supadata-video") {
    const data = await client.extractVideo<Partial<ImportedRecipe>>(
      url,
      RECIPE_EXTRACT_SCHEMA
    );
    return normaliseExtracted(data, url);
  }
  const scrape = await client.scrapeWeb(url);
  const extracted = await getGemmaProvider().extractRecipeFromText({
    content: scrape.content ?? "",
    locale: ctx.locale,
    sourceUrl: url,
  });
  return mapScrapeToImported(extracted, scrape, url);
}

export const importRecipeFromUrl: Tool<
  typeof inputSchema,
  { id: string; title: string; hasImage: boolean }
> = {
  name: "importRecipeFromUrl",
  description:
    "Import a recipe from a URL (YouTube, TikTok, Instagram, Facebook, X, or a recipe website) and save it to the user's library. The user is shown a preview to confirm before it is saved. Returns a link to the saved recipe.",
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

    let imported: ImportedRecipe;
    try {
      imported = await extractRecipe(strategy, url, ctx);
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
      { source: "url", sourceUrl: url, locale: ctx.locale }
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
