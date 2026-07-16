import { selectIngestStrategy, type IngestStrategy } from "@/lib/chat/ingestion/select-strategy";
import { getSupadataClient } from "@/lib/supadata";
import { getGemmaProvider } from "@/lib/chat/llm-gemma";
import { createIngestLogger, summarizeIngredients } from "@/lib/ingest/log";
import type { Locale } from "@/lib/chat/context";
import type { ImportedRecipe } from "@/types/recipe";
import type { ScrapeResult } from "@/lib/supadata";

/**
 * Shared URL recipe-extraction core.
 *
 * This is the single source of truth for "given a URL, produce an
 * `ImportedRecipe`". Both consumers use it:
 *  - the chat tool `importRecipeFromUrl` (preview/confirm + persist), and
 *  - the modal route `POST /api/recipes/import/url` (extract → prefill form).
 *
 * It only does extraction + mapping. It does NOT validate (callers decide
 * what "good enough" means) and it does NOT persist. Errors surface as the
 * underlying `SupadataError` / `GemmaExtractionError` so callers map them to
 * their own response shapes — `selectIngestStrategy` still throws on a
 * malformed URL.
 *
 * The image path has its own shared primitive already
 * (`GemmaProvider.extractRecipe` in `llm-gemma.ts`), so routes call that
 * directly — there is no URL/image wrapper duplication here.
 */

// Recipe JSON Schema sent to Supadata's /extract endpoint (video path only).
export const RECIPE_EXTRACT_SCHEMA = {
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

export function normaliseExtracted(
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
export function mapScrapeToImported(
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

/**
 * Extract a recipe from a URL using the selected Supadata strategy.
 *  - `supadata-video` → Supadata `/extract` with the recipe JSON Schema.
 *  - `supadata-web`   → Supadata `/web/scrape` markdown → Gemma extraction.
 *
 * Throws `SupadataError` / `GemmaExtractionError`. Does not validate the
 * result — the caller checks title/ingredients.
 */
export async function extractRecipe(
  strategy: IngestStrategy,
  url: string,
  locale?: Locale
): Promise<ImportedRecipe> {
  const client = getSupadataClient();
  const log = createIngestLogger();
  log.info("start", { strategy, url });

  if (strategy === "supadata-video") {
    // Video path: Supadata /extract does the structured extraction itself.
    const data = await client.extractVideo<Partial<ImportedRecipe>>(
      url,
      RECIPE_EXTRACT_SCHEMA
    );
    const ingredients = Array.isArray(data?.ingredients) ? data.ingredients : [];
    log.info("extract:done", { via: "supadata-extract", ...summarizeIngredients(ingredients) });
    log.debug("extract:ingredients", { ingredients });
    return normaliseExtracted(data, url);
  }

  // Web path: Supadata /web/scrape returns markdown, then Gemma turns it into a
  // structured recipe. Logging both layers makes it visible when the scrape
  // came back missing the ingredients section (the amount=0 symptom).
  const scrape = await client.scrapeWeb(url);
  log.info("scrape:done", {
    chars: scrape.content?.length ?? 0,
    countCharacters: scrape.countCharacters,
    name: scrape.name,
  });
  log.debug("scrape:content", { content: scrape.content ?? "" });

  const extracted = await getGemmaProvider().extractRecipeFromText({
    content: scrape.content ?? "",
    locale,
    sourceUrl: url,
  });
  log.info("extract:done", { via: "gemma", ...summarizeIngredients(extracted.ingredients) });
  log.debug("extract:ingredients", { ingredients: extracted.ingredients });

  return mapScrapeToImported(extracted, scrape, url);
}

export { selectIngestStrategy };
export type { IngestStrategy };
