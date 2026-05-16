import { z } from "zod";

import { persistRecipe } from "@/actions/recipe";
import {
  selectIngestStrategy,
  type IngestStrategy,
} from "@/lib/chat/ingestion/select-strategy";
import { parseRecipeFromScrape } from "@/lib/chat/ingestion/markdown-recipe-parser";
import { getSupadataClient, SupadataError } from "@/lib/supadata";
import type { ImportedRecipe } from "@/types/recipe";
import type { Tool } from "./types";

/**
 * Tool: importRecipeFromUrl (DIE-35).
 *
 * Routes a URL through the Supadata ingest pipeline:
 *  - `supadata-video` strategy → POST /extract with the recipe JSON Schema,
 *    polls the job, and maps the structured result to `ImportedRecipe`.
 *  - `supadata-web` strategy   → GET /web/scrape and parses the returned
 *    markdown into `ImportedRecipe` via the canonical-section heuristic.
 *
 * Decisión 8: there is NO Browser-Use fallback in v1. Any failure (5xx, 4xx,
 * timeout, missing title, no ingredients) surfaces as `tool.failed` with a
 * specific reason. The runtime maps this to a single user-facing message and
 * we log the failure for later host-level fallback decisions.
 *
 * Persistence is delegated to `persistRecipe` with `source: "url"`, which
 * already enforces `assertCanImportRecipe`, tags the recipe `imported`, and
 * runs Edamam nutrition analysis when macros are missing — closing US-10's
 * "see progress while a long-running task is happening" loop end-to-end.
 */

// Recipe JSON Schema sent to Supadata's /extract endpoint. Mirrors the
// canonical `ImportedRecipe` shape so the AI returns data we can map directly.
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
  createdAt: string;
}

function logImportFailure(failure: ImportFailureLog): void {
  // Lightweight telemetry — stdout for v1 (Decisión 8 / AC). Wire to a real
  // structured store (PostHog, OpenObserve) when we have aggregate volume.
  console.warn("[importRecipeFromUrl] ImportFailure", failure);
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

async function extractViaSupadata(
  strategy: IngestStrategy,
  url: string,
  signal?: AbortSignal
): Promise<ImportedRecipe> {
  const client = getSupadataClient();
  if (strategy === "supadata-video") {
    const data = await client.extractVideo<Partial<ImportedRecipe>>(
      url,
      RECIPE_EXTRACT_SCHEMA,
      { signal }
    );
    return normaliseExtracted(data, url);
  }
  const scrape = await client.scrapeWeb(url, { signal });
  return parseRecipeFromScrape(scrape, url);
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

export const importRecipeFromUrl: Tool<
  typeof inputSchema,
  { id: string; title: string }
> = {
  name: "importRecipeFromUrl",
  description:
    "Import a recipe from a URL (YouTube, TikTok, Instagram, Facebook, X, or a recipe website) and save it to the user's library. Returns a link to the saved recipe.",
  inputSchema,
  statusKey: "import.fetching",
  requiresFeature: "aiChat",
  async execute(input: Input, ctx) {
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
      return {
        ok: false,
        reason: "generic",
        message: "ingest-failed: invalid-url",
      };
    }

    // Step 1: Fetch + extract via the selected Supadata path.
    let imported: ImportedRecipe;
    try {
      imported = await extractViaSupadata(strategy, url);
    } catch (error) {
      const errorCode = error instanceof SupadataError ? error.code : "UNKNOWN";
      const status = error instanceof SupadataError ? error.status : undefined;
      logImportFailure({
        host,
        strategy,
        errorReason: "ingest-failed",
        errorCode,
        status,
        createdAt: new Date().toISOString(),
      });
      return {
        ok: false,
        reason: status === 404 ? "notFound" : "generic",
        message: `ingest-failed: ${errorCode}`,
      };
    }

    // Step 2: Partial-success guard. Recipe with no ingredients is unusable.
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
      return {
        ok: false,
        reason: "notFound",
        message: "ingest-failed: no-ingredients",
      };
    }

    // Step 3: Persist. `persistRecipe` enforces `assertCanImportRecipe`,
    // tags the recipe `imported`, and auto-runs Edamam nutrition analysis
    // because shouldAnalyze defaults to true for url/imported sources.
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
        sourceUrl: imported.sourceUrl,
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
      data: { id: persisted.data.id, title: persisted.data.title },
      link: {
        type: "recipe",
        href: `/recipes/${persisted.data.id}`,
        label: persisted.data.title,
      },
    };
  },
};
