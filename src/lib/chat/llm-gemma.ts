import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, Output, type LanguageModel } from "ai";

import {
  importedRecipeSchema,
  type ImportedRecipeData,
} from "@/lib/ingest/imported-recipe-schema";

// DIE-41 — Gemma 4 image-extraction provider. Lives INSIDE the
// importRecipeFromImage tool, NOT in the orchestrator loop. The orchestrator
// (Claude Sonnet via AnthropicLlmProvider) decides to call the tool when it
// sees an attachment ref in the user message; this provider is the tool's
// internal call to Google's Gemini API to extract a structured ImportedRecipe
// from raw image bytes.
//
// Why Gemini API (Google AI Studio) and NOT Vertex AI:
//   - Gemma 4 31B is serverless on Gemini API (`gemma-4-31b-it`).
//   - On Vertex AI Model Garden, only the 26B MoE is serverless; 31B requires
//     self-deploy on GPUs/TPUs. Eliminated to keep v1 zero-ops.
//   - Migration to Vertex AI later is provider-class swap only — the tool
//     and the chat flow do NOT need to change.
//
// Failure surface: typed errors mapped by importRecipeFromImage to the
// tool.failed { error.kind, error.reason } shape the FE understands.

const DEFAULT_MODEL = "gemma-4-31b-it";

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
   * Optional pre-built LanguageModel — used by unit tests to inject a fake
   * model instead of going through createGoogleGenerativeAI. When provided,
   * apiKey and model are ignored.
   */
  modelOverride?: LanguageModel;
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
  private readonly model: LanguageModel;

  constructor(opts: GemmaProviderOptions = {}) {
    if (opts.modelOverride) {
      this.model = opts.modelOverride;
    } else {
      const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "GemmaProvider: GEMINI_API_KEY is not set. Either pass apiKey or inject modelOverride for tests."
        );
      }
      const google = createGoogleGenerativeAI({ apiKey });
      this.model = google(opts.model ?? process.env.GEMMA_MODEL ?? DEFAULT_MODEL);
    }
  }

  async extractRecipe(args: ExtractRecipeArgs): Promise<ImportedRecipeData> {
    const locale = args.locale ?? "en";
    const systemPrompt = `${PROMPT_BASE}\n\n${LOCALE_HINT[locale]}`;

    let recipe: ImportedRecipeData;
    try {
      const result = await generateText({
        model: this.model,
        output: Output.object({ schema: importedRecipeSchema }),
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the recipe from this image.",
              },
              {
                type: "image",
                image: args.imageBytes,
                mediaType: args.mimeType,
              },
            ],
          },
        ],
      });
      recipe = result.output as ImportedRecipeData;
    } catch (err) {
      // Schema mismatch (model returned malformed JSON) is the most common
      // non-transient failure. Treat anything else as transient — the tool
      // does not retry today (one-shot extraction is cheap to ask the user to
      // retry manually), but the reason gives us per-error telemetry.
      const message = err instanceof Error ? err.message : String(err);
      if (/schema|validation|parse/i.test(message)) {
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

    // The schema accepts empty ingredients on purpose so the caller can map
    // it to a user-facing "no-ingredients" reason. Image-quality signal: if
    // Gemma returned a title but ZERO ingredients, that's almost always "the
    // photo is too blurry / not a recipe" rather than a legitimate recipe
    // with no ingredients (which doesn't exist).
    if (recipe.ingredients.length === 0) {
      // Distinguish: title present → low quality; no title → no recipe at all.
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
