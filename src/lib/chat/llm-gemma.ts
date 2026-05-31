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
// Model: gemini-2.0-flash-exp (vision + native structured output via responseSchema).
// Previous approach (@ai-sdk/google + gemma-4-31b-it) was abandoned because that
// model ID does not exist in the Gemini Developer API.
//
// Lives INSIDE the importRecipeFromImage tool — not in the orchestrator loop.

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
    const responseSchema = zodToJsonSchema(importedRecipeSchema);

    const params: GenerateContentParameters = {
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
        responseSchema,
      },
    };

    let recipe: ImportedRecipeData;
    try {
      const response = await this.client.models.generateContent(params);
      const text = response.text;
      if (!text) {
        throw new GemmaExtractionError(
          "transient",
          "Gemma returned an empty response"
        );
      }
      const parsed: unknown = JSON.parse(text);
      recipe = importedRecipeSchema.parse(parsed);
    } catch (err) {
      if (err instanceof GemmaExtractionError) throw err;

      const message = err instanceof Error ? err.message : String(err);
      if (/schema|validation|parse|ZodError/i.test(message)) {
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

    // Schema accepts empty ingredients so the caller can surface "no-ingredients".
    // Title present + zero ingredients → blurry photo. No title → not a recipe.
    if (recipe.ingredients.length === 0) {
      const reason =
        recipe.title && recipe.title.trim().length > 0
          ? "low-quality"
          : "no-ingredients";
      throw new GemmaExtractionError(
        reason,
        `Gemma extracted no usable ingredients (title=${JSON.stringify(recipe.title)})`
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
