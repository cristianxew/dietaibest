/**
 * LLM recipe-resolution stage (Stage 2, Gemini on Vertex) — ADR 0003 + ADR 0004.
 *
 * Runs once per recipe AFTER name canonicalization + USDA candidate retrieval. It
 * is the food-resolution intelligence layer (ADR 0004, RAG): given the recipe and,
 * per ingredient, the original line + parsed qty/unit + canonical name + the
 * fetched USDA candidate foods (with per-100g macros), it returns per ingredient:
 *   - chosenFdcId — the candidate that best matches what the recipe means
 *     (variety/state aware: "fresh salmon" → farmed Atlantic, not wild), or null
 *     when no candidate fits (caller falls through to a flagged macro estimate);
 *   - grams — the LLM's total edible-gram estimate, used for count/household units
 *     the deterministic ladder cannot weigh (a graham roll ≈ 57 g);
 *   - cookedState + retentionFactor — micronutrient retention (energy + macros are
 *     conserved; applied to micros only downstream);
 * plus recipe dietLabels/healthLabels.
 *
 * Safety: chosenFdcId is validated against the candidate ids the caller supplied —
 * the model can never invent an id. Below a confidence threshold the cooked/raw
 * judgment and the gram override are dropped (raw-as-entered, deterministic grams)
 * and the ingredient is flagged; retention is always clamped to [0,1]. Best-effort:
 * any failure returns a safe empty result so analysis degrades, never breaks.
 *
 * @module lib/recipe-analyzer
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { buildGenAIVertexOptions } from "./chat/tools/genai-options";

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Below this confidence the cooked/raw judgment + gram override are not trusted:
 * the ingredient is forced to raw-as-entered (retention 1.0, deterministic grams)
 * and flagged. The food selection is kept (it is a real candidate either way).
 */
const CONFIDENCE_THRESHOLD = 0.6;

/** One USDA candidate offered to the selector (per-100g macros). */
export interface RecipeAnalyzerCandidate {
  fdcId: number;
  description: string;
  dataType: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

/** One ingredient for Stage 2: original line, parsed qty/unit, canonical name, candidates. */
export interface RecipeAnalyzerItem {
  line: string;
  qty: number;
  unit: string;
  name: string;
  candidates: RecipeAnalyzerCandidate[];
}

export interface RecipeAnalyzerInput {
  /** Recipe title — context for selection + the cooked/raw + label judgment. */
  title?: string;
  items: RecipeAnalyzerItem[];
}

/** Per-ingredient Stage-2 resolution after validation + the safety clamp. */
export interface RecipeIngredientAnalysis {
  name: string;
  /** Chosen USDA candidate id (validated ∈ candidates), or null → estimate. */
  chosenFdcId: number | null;
  /** LLM total-gram estimate, honored for count/household units; null = defer. */
  grams: number | null;
  cookedState: "raw" | "cooked";
  /** Nutrient-retention multiplier in [0,1] (1 = no cooking loss applied). */
  retentionFactor: number;
  /** The model's confidence in the cooked/portion judgment (0–1). */
  confidence: number;
  /** True when the safety clamp overrode the model (low confidence). */
  flagged: boolean;
}

export interface RecipeAnalysis {
  perIngredient: RecipeIngredientAnalysis[];
  dietLabels: string[];
  healthLabels: string[];
}

const responseSchema = z.object({
  ingredients: z.array(
    z.object({
      name: z.string(),
      chosenFdcId: z.number().nullable(),
      grams: z.number().nullable(),
      cookedState: z.enum(["raw", "cooked"]),
      retentionFactor: z.number(),
      confidence: z.number(),
    })
  ),
  dietLabels: z.array(z.string()),
  healthLabels: z.array(z.string()),
});

const SYSTEM_INSTRUCTION = `You resolve recipe ingredients to the best USDA food + portion for an accurate nutrition calculation.
You get the recipe title and, per ingredient: the original line, parsed quantity + unit, a canonical name, and a list of CANDIDATE USDA foods (fdcId, description, dataType, and per-100g kcal/protein/fat/carbs).
For EACH ingredient return:
- chosenFdcId: the fdcId of the candidate that best matches what the recipe actually means. Judge variety from context (e.g. "fresh salmon" in a dinner is usually farmed Atlantic, not wild). CRITICAL — match the food's form to the WEIGHT BASIS: dry staples (rice, pasta, quinoa, oats, lentils, flour) given by weight are measured DRY, so pick the RAW/UNCOOKED/dry entry, never the "cooked" one (the entered grams are dry grams; cookedState + retentionFactor capture the cooking separately). Avoid any candidate showing 0 kcal unless the food is genuinely calorie-free (salt, water). Prefer Foundation/SR Legacy over Branded when equivalent. Return null ONLY when no candidate is a reasonable match.
- grams: your best estimate of the TOTAL edible grams this ingredient contributes as written (quantity × unit). For count/household units (piece, slice, roll, clove, "medium", handful) use typical real-world weights (1 bread roll ≈ 57 g; 1 medium banana ≈ 120 g; 1 clove garlic ≈ 3 g). For explicit weights/volumes, just convert (200 g → 200; 1 cup water → 240).
- cookedState ("raw" or "cooked" in the finished dish), retentionFactor (0–1 micronutrient retention from cooking; 1 for raw), and confidence (0–1; be honest and LOW when the line or portion is ambiguous).
Also return recipe-level dietLabels (e.g. "high-protein") and healthLabels (e.g. "vegan", "gluten-free"); [] when none clearly apply.
Return exactly one ingredient object per input and copy the input name verbatim into "name".`;

/** Empty, no-op Stage-2 result. */
function emptyAnalysis(): RecipeAnalysis {
  return { perIngredient: [], dietLabels: [], healthLabels: [] };
}

/** Clamp a number into [0,1]; non-finite → fallback. */
function clamp01(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export class RecipeAnalyzer {
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
          "RecipeAnalyzer: GOOGLE_CLOUD_PROJECT_ID is not set in environment."
        );
      }
      this.client = new GoogleGenAI(options);
    }
  }

  async analyze(input: RecipeAnalyzerInput): Promise<RecipeAnalysis> {
    if (input.items.length === 0) return emptyAnalysis();
    try {
      const lines = input.items
        .map((it, i) => {
          const cands = it.candidates
            .map(
              (c) =>
                `      [${c.fdcId}] ${c.description} (${c.dataType}) — ${c.kcal}kcal P${c.protein} F${c.fat} C${c.carbs} /100g`
            )
            .join("\n");
          return `${i + 1}. line="${it.line}" qty=${it.qty} unit=${it.unit} canonical="${it.name}"\n    candidates:\n${cands || "      (none)"}`;
        })
        .join("\n");
      const prompt = `Recipe title: ${input.title ?? "(untitled)"}\nIngredients:\n${lines}`;

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
      if (!text) return emptyAnalysis();
      const parsed = responseSchema.parse(JSON.parse(text));

      // Match answers to inputs BY INDEX (the model returns one per input in
      // order) — robust against the model echoing the wrong name and against
      // duplicate canonical names. The output `name` is the input's (authoritative).
      const perIngredient = input.items.map(
        (item, i): RecipeIngredientAnalysis => {
          const r = parsed.ingredients[i];
          if (!r) {
            // Model returned fewer rows than inputs — no-op this ingredient.
            return { name: item.name, chosenFdcId: null, grams: null, cookedState: "raw", retentionFactor: 1, confidence: 0, flagged: true };
          }
          // The model may only choose an id we offered for THIS ingredient.
          const validIds = new Set(item.candidates.map((c) => c.fdcId));
          const chosenFdcId =
            r.chosenFdcId != null && validIds.has(r.chosenFdcId)
              ? r.chosenFdcId
              : null;
          const grams =
            r.grams != null && Number.isFinite(r.grams) && r.grams > 0
              ? r.grams
              : null;

          // Cooked-weight safety: don't trust a low-confidence cooked/raw or
          // portion call — default to raw-as-entered, deterministic grams, flag.
          if (r.confidence < CONFIDENCE_THRESHOLD) {
            return {
              name: item.name,
              chosenFdcId,
              grams: null,
              cookedState: "raw",
              retentionFactor: 1,
              confidence: r.confidence,
              flagged: true,
            };
          }
          return {
            name: item.name,
            chosenFdcId,
            grams,
            cookedState: r.cookedState,
            retentionFactor: clamp01(r.retentionFactor, 1),
            confidence: r.confidence,
            flagged: false,
          };
        }
      );

      return {
        perIngredient,
        dietLabels: parsed.dietLabels,
        healthLabels: parsed.healthLabels,
      };
    } catch (err) {
      console.error(
        "[recipe-analyzer] failed:",
        err instanceof Error ? err.message : String(err)
      );
      return emptyAnalysis();
    }
  }
}

let providerOverride: RecipeAnalyzer | null = null;
let providerSingleton: RecipeAnalyzer | null = null;

export function setRecipeAnalyzerForTest(c: RecipeAnalyzer | null): void {
  providerOverride = c;
}

export function getRecipeAnalyzer(): RecipeAnalyzer {
  if (providerOverride) return providerOverride;
  if (!providerSingleton) providerSingleton = new RecipeAnalyzer();
  return providerSingleton;
}
