/**
 * LLM ingredient-name canonicalizer (Gemini, Vertex).
 *
 * Normalizes a free-text / multilingual ingredient name to a generic English
 * name suitable for USDA FoodData Central matching. Used ONLY as a cached
 * fallback. Best-effort: any failure returns an empty map so recipe analysis
 * never breaks.
 *
 * @module lib/ingredient-canonicalizer
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { buildGenAIVertexOptions } from "./chat/tools/genai-options";

const DEFAULT_MODEL = "gemini-2.5-flash";

const responseSchema = z.object({
  items: z.array(
    z.object({ raw: z.string(), canonical: z.string().nullable() })
  ),
});

const SYSTEM_INSTRUCTION = `You normalize recipe ingredient names for the USDA FoodData Central database.
For each input name return a generic English ingredient name: singular, no brand, no preparation/state words, no quantities.
Examples: "mięso z piersi kurczaka" -> "chicken breast"; "oliwa z oliwek" -> "olive oil"; "komosa ryżowa" -> "quinoa".
Return canonical = null for anything that is not a food ingredient (section headers, utensils, noise).
Return exactly one object per input and copy the input verbatim into "raw".`;

export class IngredientCanonicalizer {
  private readonly client: Pick<GoogleGenAI, "models">;
  private readonly modelId: string;

  constructor(
    opts: { clientOverride?: Pick<GoogleGenAI, "models">; model?: string } = {}
  ) {
    this.modelId = opts.model ?? process.env.GEMMA_MODEL ?? DEFAULT_MODEL;
    if (opts.clientOverride) {
      this.client = opts.clientOverride;
    } else {
      const options = buildGenAIVertexOptions(process.env);
      if (!options) {
        throw new Error(
          "IngredientCanonicalizer: GOOGLE_CLOUD_PROJECT_ID is not set in environment."
        );
      }
      this.client = new GoogleGenAI(options);
    }
  }

  async canonicalize(rawNames: string[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (rawNames.length === 0) return out;
    try {
      const prompt = `Normalize these ingredient names:\n${rawNames
        .map((n, i) => `${i + 1}. ${n}`)
        .join("\n")}`;
      const response = await this.client.models.generateContent({
        model: this.modelId,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: zodToJsonSchema(responseSchema),
        },
      });
      const text = response.text;
      if (!text) return out;
      const parsed = responseSchema.parse(JSON.parse(text));
      for (const item of parsed.items) out.set(item.raw, item.canonical);
    } catch (err) {
      console.error(
        "[ingredient-canonicalizer] failed:",
        err instanceof Error ? err.message : String(err)
      );
      return new Map();
    }
    return out;
  }
}

let providerOverride: IngredientCanonicalizer | null = null;
let providerSingleton: IngredientCanonicalizer | null = null;

export function setIngredientCanonicalizerForTest(
  c: IngredientCanonicalizer | null
): void {
  providerOverride = c;
}

export function getIngredientCanonicalizer(): IngredientCanonicalizer {
  if (providerOverride) return providerOverride;
  if (!providerSingleton) providerSingleton = new IngredientCanonicalizer();
  return providerSingleton;
}
