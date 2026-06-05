import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import { zodToJsonSchema } from "zod-to-json-schema";

import {
  importedRecipeSchema,
  type ImportedRecipeData,
} from "@/lib/ingest/imported-recipe-schema";

// DIE-41 — Recipe extraction provider using @google/genai (official Google Gen AI SDK).
// Uses Vertex AI backend (vertexai: true) with Application Default Credentials —
// the same ADC already configured for @google-cloud/documentai. No separate API key needed.
//
// Default model: gemini-2.5-flash (see DEFAULT_MODEL) — vision + native structured
// output. Extraction runs through models.generateContent() with a responseSchema
// (responseMimeType "application/json") derived from importedRecipeSchema.
//
// The provider factory (getGemmaProvider/setGemmaProviderForTest) lives here and is
// shared by both import tools — importRecipeFromImage and importRecipeFromUrl.

const DEFAULT_MODEL = "gemini-2.5-flash";

export class GemmaExtractionError extends Error {
  readonly reason:
    | "no-ingredients"
    | "low-quality"
    | "unsupported-format"
    | "schema-mismatch"
    | "transient";

  constructor(
    reason: GemmaExtractionError["reason"],
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = "GemmaExtractionError";
    this.reason = reason;
  }
}

export interface GemmaProviderOptions {
  apiKey?: string;
  model?: string;
  /**
   * Optional pre-built client — used by unit tests to inject a fake instead of
   * going through GoogleGenAI. When provided, apiKey/model are ignored.
   */
  clientOverride?: Pick<GoogleGenAI, "models">;
}

export interface ExtractRecipeArgs {
  imageBytes: Uint8Array;
  mimeType: string;
  locale?: "en" | "es" | "pl";
}

export interface ExtractRecipeFromTextArgs {
  content: string;
  locale?: "en" | "es" | "pl";
  sourceUrl?: string;
}

/** Hard cap on markdown sent to the model — recipes fit comfortably; this
 * bounds token cost on blog pages with huge preamble. */
const MAX_CONTENT_CHARS = 24_000;

const PROMPT_BASE_TEXT = `You are a kitchen assistant extracting a structured recipe from the scraped Markdown of a web page. The Markdown may include navigation, ads, comments, related-recipe lists, and other noise around the recipe.

Output a JSON object that conforms to the provided schema. Be precise:

- title: the dish's name. Trim quotation marks and ellipses.
- ingredients: each line as { name, amount, unit }. Amount is a number (use 0 only if quantity is literally absent). Unit is the singular form ("cup", "tbsp", "g", "ml"). Keep ingredient names in the source language.
- instructions: each step as one string in the source language. Skip section headers ("Preparation", "For the sauce").
- servings: integer >= 1, only if explicitly stated.
- prepTime / cookTime: integer minutes, only if explicitly stated.
- description, cuisine, difficulty, tags, nutrition fields: omit entirely if not present.

Do NOT invent ingredients or quantities. If the page does not contain a recipe (e.g. a category listing, a blog index, a product page), return an empty ingredients array — the calling tool surfaces "no-ingredients" to the user.

If multiple recipes appear, extract only the main one the page is about.`;

const LOCALE_HINT_TEXT: Record<NonNullable<ExtractRecipeFromTextArgs["locale"]>, string> = {
  en: "If the page is in another language, keep ingredient/instruction text in that language — the user picked an English UI but the recipe stays in its source language.",
  es: "Si la página está en otro idioma, mantené los ingredientes e instrucciones en ese idioma. El usuario eligió español pero la receta queda en su idioma fuente.",
  pl: "Jeśli strona jest w innym języku, zachowaj składniki i instrukcje w tym języku. Użytkownik wybrał polski interfejs, ale przepis pozostaje w języku źródłowym.",
};

const PROMPT_BASE = `You are a kitchen assistant extracting a structured recipe from a single image. The image may be a cookbook page, a social-media screenshot, a restaurant chalkboard, a handwritten note, or a phone photo of a printed recipe.

Output a JSON object that conforms to the provided schema. Be precise:

- title: the dish's name as written. Trim quotation marks and ellipses.
- ingredients: each line as { name, amount, unit }. Amount is a number (use 0 only if quantity is literally absent). Unit is the singular form ("cup", "tbsp", "g", "ml"). Keep ingredient names in the source language.
- instructions: each step as one string in the source language. Skip section headers ("Preparation", "For the sauce").
- servings: integer >= 1, only if explicitly stated.
- prepTime / cookTime: integer minutes, only if explicitly stated.
- description, cuisine, difficulty, tags, nutrition fields: omit entirely if not in the image.

Do NOT invent ingredients or quantities. If the image clearly does not contain a recipe (e.g. landscape, person, food product label without instructions), return an empty ingredients array — the calling tool surfaces "no-ingredients" to the user.

If multiple recipes appear in one image, extract only the most prominent one (largest, centered, or titled).`;

const LOCALE_HINT: Record<NonNullable<ExtractRecipeArgs["locale"]>, string> = {
  en: "If the image is in another language, keep ingredient/instruction text in that language — the user picked an English UI but the recipe stays in its source language.",
  es: "Si la imagen está en otro idioma, mantené los ingredientes e instrucciones en ese idioma. El usuario eligió español pero la receta queda en su idioma fuente.",
  pl: "Jeśli obraz jest w innym języku, zachowaj składniki i instrukcje w tym języku. Użytkownik wybrał polski interfejs, ale przepis pozostaje w języku źródłowym.",
};

export class GemmaProvider {
  private readonly client: Pick<GoogleGenAI, "models">;
  private readonly modelId: string;

  constructor(opts: GemmaProviderOptions = {}) {
    this.modelId = opts.model ?? process.env.GEMMA_MODEL ?? DEFAULT_MODEL;

    if (opts.clientOverride) {
      this.client = opts.clientOverride;
    } else {
      const project = process.env.GOOGLE_CLOUD_PROJECT_ID;
      const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";
      
      if (!project) {
        throw new Error("GemmaProvider: GOOGLE_CLOUD_PROJECT_ID is not set in environment.");
      }

      this.client = new GoogleGenAI({
        vertexai: true,
        project,
        location,
      });
    }
  }

  async extractRecipe(args: ExtractRecipeArgs): Promise<ImportedRecipeData> {
    const locale = args.locale ?? "en";
    const systemInstruction = `${PROMPT_BASE}\n\n${LOCALE_HINT[locale]}`;
    const base64 = Buffer.from(args.imageBytes).toString("base64");

    return this.runExtraction({
      model: this.modelId,
      contents: [
        {
          role: "user",
          parts: [
            { text: "Extract the recipe from this image." },
            { inlineData: { data: base64, mimeType: args.mimeType } },
          ],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: zodToJsonSchema(importedRecipeSchema),
      },
    });
  }

  async extractRecipeFromText(
    args: ExtractRecipeFromTextArgs
  ): Promise<ImportedRecipeData> {
    const locale = args.locale ?? "en";
    const systemInstruction = `${PROMPT_BASE_TEXT}\n\n${LOCALE_HINT_TEXT[locale]}`;
    const content = args.content.slice(0, MAX_CONTENT_CHARS);

    const recipe = await this.runExtraction({
      model: this.modelId,
      contents: [
        {
          role: "user",
          parts: [{ text: `Extract the recipe from this web page content:\n\n${content}` }],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: zodToJsonSchema(importedRecipeSchema),
      },
    });

    if (args.sourceUrl) recipe.sourceUrl = args.sourceUrl;
    return recipe;
  }

  /** Shared transport + parse + validation + error mapping for both extractors. */
  private async runExtraction(
    params: GenerateContentParameters
  ): Promise<ImportedRecipeData> {
    let rawText: string;
    try {
      const response = await this.client.models.generateContent(params);
      const text = response.text;
      if (!text) {
        throw new GemmaExtractionError("transient", "Gemma returned an empty response");
      }
      rawText = text;
    } catch (err) {
      if (err instanceof GemmaExtractionError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new GemmaExtractionError(
        "transient",
        `Gemma extraction failed: ${message}`,
        { cause: err }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new GemmaExtractionError(
        "transient",
        `Gemma returned non-JSON response: ${message}`,
        { cause: err }
      );
    }

    // Check for the no-ingredients signal BEFORE strict schema validation so we
    // surface a meaningful reason even when the title field is empty/invalid.
    // A model that found no recipe typically returns { title: "", ingredients: [] }.
    const asRecord = parsed as Record<string, unknown>;
    const ingredients = asRecord?.ingredients;
    if (Array.isArray(ingredients) && ingredients.length === 0) {
      const title = typeof asRecord?.title === "string" ? asRecord.title : "";
      const reason = title.trim().length > 0 ? "low-quality" : "no-ingredients";
      throw new GemmaExtractionError(
        reason,
        `Gemma extracted no usable ingredients (title=${JSON.stringify(title)})`
      );
    }

    let recipe: ImportedRecipeData;
    try {
      recipe = importedRecipeSchema.parse(parsed);
    } catch (err) {
      if (err instanceof GemmaExtractionError) throw err;
      const name = err instanceof Error ? err.name : "";
      const message = err instanceof Error ? err.message : String(err);
      if (/schema|validation|parse|ZodError/i.test(message) || name === "ZodError") {
        throw new GemmaExtractionError(
          "schema-mismatch",
          `Gemma returned data that did not match the recipe schema: ${message}`,
          { cause: err }
        );
      }
      throw new GemmaExtractionError(
        "transient",
        `Gemma extraction failed: ${message}`,
        { cause: err }
      );
    }

    return recipe;
  }
}

// ---------------------------------------------------------------------------
// Shared lazy singleton. Lives here (not in a tool) so importRecipeFromImage
// and importRecipeFromUrl share one provider, and tests inject one fake via
// setGemmaProviderForTest.
// ---------------------------------------------------------------------------
let providerOverride: GemmaProvider | null = null;
let providerSingleton: GemmaProvider | null = null;

export function setGemmaProviderForTest(p: GemmaProvider | null): void {
  providerOverride = p;
}

export function getGemmaProvider(): GemmaProvider {
  if (providerOverride) return providerOverride;
  if (!providerSingleton) providerSingleton = new GemmaProvider();
  return providerSingleton;
}
