/**
 * LLM ingredient-name canonicalizer (Gemini, Vertex).
 *
 * The PRIMARY normalizer for the nutrition engine (ADR 0003): it turns a
 * free-text / multilingual ingredient name into a generic English name suitable
 * for USDA FoodData Central matching (`canonicalize`), and — for foods USDA does
 * not carry — estimates per-100g macros as a flagged last resort
 * (`estimateMacros`). Both are best-effort: any failure returns an empty map so
 * recipe analysis degrades honestly instead of breaking.
 *
 * @module lib/ingredient-canonicalizer
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { buildGenAIVertexOptions } from "./chat/tools/genai-options";

const DEFAULT_MODEL = "gemini-2.5-flash";

/** Per-100g macro estimate for a food USDA does not carry. */
export interface MacroEstimate {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

const responseSchema = z.object({
  items: z.array(
    z.object({ raw: z.string(), canonical: z.string().nullable() })
  ),
});

const estimateSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      kcal: z.number().nullable(),
      protein: z.number().nullable(),
      fat: z.number().nullable(),
      carbs: z.number().nullable(),
      fiber: z.number().nullable(),
    })
  ),
});

const SYSTEM_INSTRUCTION = `You normalize recipe ingredient names for the USDA FoodData Central database.
For each input name return a generic English ingredient name: singular, no brand, no preparation/state words, no quantities.
Examples: "mięso z piersi kurczaka" -> "chicken breast"; "oliwa z oliwek" -> "olive oil"; "komosa ryżowa" -> "quinoa".
Return canonical = null for anything that is not a food ingredient (section headers, utensils, noise).
Return exactly one object per input and copy the input verbatim into "raw".`;

const ESTIMATE_INSTRUCTION = `You are a nutrition database. For each food name, estimate its nutrition PER 100 GRAMS of the edible food as commonly prepared.
Return numeric grams for protein/fat/carbs/fiber and kcal for energy. Be realistic; use typical published values for the generic food.
If a name is NOT a real food (a section header, utensil, or noise), return all five fields as null.
Return exactly one object per input and copy the input verbatim into "name".`;

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

  /**
   * Estimate per-100g macros for foods USDA does not carry. Last resort in the
   * coverage chain (FDC → estimate → honest gap): callers flag the result as an
   * estimate. A name the model can't estimate maps to null (treated as a true
   * miss). Best-effort: any failure returns an empty map.
   */
  async estimateMacros(
    names: string[]
  ): Promise<Map<string, MacroEstimate | null>> {
    const out = new Map<string, MacroEstimate | null>();
    if (names.length === 0) return out;
    try {
      const prompt = `Estimate per-100g nutrition for:\n${names
        .map((n, i) => `${i + 1}. ${n}`)
        .join("\n")}`;
      const response = await this.client.models.generateContent({
        model: this.modelId,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: ESTIMATE_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: zodToJsonSchema(estimateSchema),
        },
      });
      const text = response.text;
      if (!text) return out;
      const parsed = estimateSchema.parse(JSON.parse(text));
      for (const item of parsed.items) {
        const { name, kcal, protein, fat, carbs, fiber } = item;
        // A missing energy value means the model declined to estimate this name
        // (not a food, or unknown) — treat the whole row as a true miss.
        if (kcal === null) {
          out.set(name, null);
          continue;
        }
        out.set(name, {
          kcal,
          protein: protein ?? 0,
          fat: fat ?? 0,
          carbs: carbs ?? 0,
          fiber: fiber ?? 0,
        });
      }
    } catch (err) {
      console.error(
        "[ingredient-canonicalizer] estimateMacros failed:",
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
