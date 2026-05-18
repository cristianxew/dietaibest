import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText, type LanguageModel } from "ai";
import { z } from "zod";

import { type ImportedRecipeData } from "@/lib/ingest/imported-recipe-schema";

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

const PROMPT_BASE = `You are a kitchen assistant that extracts structured recipe data from images.

IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no explanation, no code blocks. Raw JSON only.

The JSON must have this exact shape:
{
  "title": "string (required — the dish name as written)",
  "ingredients": [{ "name": "string", "amount": number, "unit": "string" }],
  "instructions": ["string"],
  "servings": number or omit,
  "prepTime": number (minutes) or omit,
  "cookTime": number (minutes) or omit,
  "description": "string" or omit,
  "cuisine": "string" or omit,
  "difficulty": "easy" | "medium" | "hard" or omit,
  "tags": ["string"] or omit
}

Rules:
- title: required, trim quotes and ellipses.
- ingredients[].name: keep in the source language of the image.
- ingredients[].amount: use 0 for "to taste" / "a pinch" / quantities absent.
- ingredients[].unit: singular form ("cup", "tbsp", "g", "ml", "unit"). Use "unit" when no unit is stated.
- instructions: one string per step. Skip section headers.
- omit optional fields entirely when not stated in the image.
- If the image does NOT contain a recipe (landscape, portrait, product label), return { "title": "", "ingredients": [], "instructions": [] }.
- If multiple recipes appear, extract only the most prominent one.
- Do NOT invent data. Only output what you can read in the image.`;

const LOCALE_HINT: Record<NonNullable<ExtractRecipeArgs["locale"]>, string> = {
  en: "If the image is in another language, keep ingredient/instruction text in that language — the user picked an English UI but the recipe stays in its source language.",
  es: "Si la imagen está en otro idioma, mantené los ingredientes e instrucciones en ese idioma. El usuario eligió español pero la receta queda en su idioma fuente.",
  pl: "Jeśli obraz jest w innym języku, zachowaj składniki i instrukcje w tym języku. Użytkownik wybrał polski interfejs, ale przepis pozostaje w języku źródłowym.",
};

// Lenient schema for extraction — more permissive than the app-level schemas
// because LLMs (especially vision models) produce noisy output:
//   - amount >= 0 (Gemma uses 0 for "to taste"; the app schema requires > 0)
//   - unit: allow empty string (Gemma may omit for items like "eggs")
//   - title: allow empty (we map "" to no-ingredients later)
const extractionIngredientSchema = z.object({
  name: z.string(),
  amount: z.number().min(0).default(0),
  unit: z.string().default("unit"),
});

const extractionSchema = z.object({
  title: z.string().default(""),
  description: z.string().optional(),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  ingredients: z.array(extractionIngredientSchema).default([]),
  instructions: z.array(z.string()).default([]),
  tags: z.array(z.string()).optional(),
  cuisine: z.string().optional(),
});

// Pull a JSON object out of a model response that may include markdown fences
// or surrounding prose. Throws if no valid JSON object is found.
function extractJsonObject(text: string): unknown {
  // Try ```json ... ``` or ``` ... ``` blocks first
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Find the outermost { ... } span
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

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

    // Use plain generateText — no native structured-output dependency.
    // Gemma models on Gemini API don't reliably support JSON-mode enforcement,
    // so we prompt-engineer the JSON shape and parse manually.
    let raw: string;
    try {
      const result = await generateText({
        model: this.model,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the recipe from this image. Return raw JSON only.",
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
      raw = result.text;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new GemmaExtractionError(
        "transient",
        `Gemma generation failed: ${message}`,
        { cause: err }
      );
    }

    // Extract the JSON object from the response text.
    // The model might wrap it in ```json ... ``` or return raw text.
    let parsed: unknown;
    try {
      parsed = extractJsonObject(raw);
    } catch {
      throw new GemmaExtractionError(
        "schema-mismatch",
        `Gemma response contained no parseable JSON. Raw (first 200 chars): ${raw.slice(0, 200)}`
      );
    }

    // Validate with a lenient extraction schema (amount >= 0, unit may be empty).
    const validated = extractionSchema.safeParse(parsed);
    if (!validated.success) {
      throw new GemmaExtractionError(
        "schema-mismatch",
        `Gemma returned data that did not match the recipe schema: ${validated.error.message}`
      );
    }

    let recipe: ImportedRecipeData = validated.data;

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
