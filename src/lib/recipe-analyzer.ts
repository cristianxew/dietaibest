/**
 * LLM recipe-stage analyzer (Stage 2, Gemini on Vertex) — ADR 0003.
 *
 * The recipe-scoped LLM stage that runs AFTER name canonicalization + USDA
 * matching (Stage 1). For the whole recipe it returns, per ingredient, a
 * cooked/raw judgment + a nutrient-retention factor (cooking destroys some
 * vitamins), plus recipe-level diet/health labels.
 *
 * Cooked-weight safety (ADR 0003): a wrong cooked/raw call can 2–3× the grams,
 * and the match-quality guard does NOT protect gram weight. So when the model is
 * not confident this analyzer **defaults to raw-as-entered with retentionFactor
 * 1.0 and flags the ingredient** — it never silently scales anything. The
 * retention factor is always clamped into [0,1] defensively.
 *
 * Best-effort, like the Stage-1 canonicalizer: any failure returns a safe empty
 * result so recipe analysis degrades to "no Stage-2 adjustment" rather than
 * breaking.
 *
 * @module lib/recipe-analyzer
 */
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { buildGenAIVertexOptions } from "./chat/tools/genai-options";

const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Below this confidence the cooked/raw judgment is not trusted: the ingredient
 * is forced to raw-as-entered (retention 1.0) and flagged.
 */
const CONFIDENCE_THRESHOLD = 0.6;

/** One ingredient for Stage 2: its canonical name, resolved grams, USDA description. */
export interface RecipeAnalyzerItem {
  name: string;
  grams: number;
  description: string | null;
}

export interface RecipeAnalyzerInput {
  /** Recipe title — context for the cooked/raw + label judgment. Optional. */
  title?: string;
  items: RecipeAnalyzerItem[];
}

/** Per-ingredient Stage-2 judgment after the cooked-weight safety clamp. */
export interface RecipeIngredientAnalysis {
  name: string;
  cookedState: "raw" | "cooked";
  /** Nutrient-retention multiplier in [0,1] (1 = no cooking loss applied). */
  retentionFactor: number;
  /** The model's confidence in the cooked/raw judgment (0–1). */
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
      cookedState: z.enum(["raw", "cooked"]),
      retentionFactor: z.number(),
      confidence: z.number(),
    })
  ),
  dietLabels: z.array(z.string()),
  healthLabels: z.array(z.string()),
});

const SYSTEM_INSTRUCTION = `You analyze a cooked recipe for nutrition adjustment. You are given the recipe title and its matched ingredients (canonical English name + grams + the USDA food description we matched).
For EACH ingredient return:
- cookedState: "cooked" if the dish cooks this ingredient, otherwise "raw".
- retentionFactor: a number in [0,1] for nutrient retention after cooking (1 = no loss; e.g. ~0.75 for boiled leafy greens). Use 1 for raw ingredients.
- confidence: 0–1, how sure you are about the cooked/raw judgment. Be honest; use a LOW value when the recipe context is ambiguous.
For the whole recipe return dietLabels (e.g. "high-protein", "low-carb") and healthLabels (e.g. "vegan", "gluten-free", "dairy-free"). Use [] when none clearly apply.
Return exactly one ingredient object per input, copying the input name verbatim into "name".`;

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
        .map(
          (it, i) =>
            `${i + 1}. ${it.name} — ${it.grams}g (USDA match: ${it.description ?? "none"})`
        )
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

      const perIngredient = parsed.ingredients.map(
        (r): RecipeIngredientAnalysis => {
          // Cooked-weight safety: don't trust a low-confidence cooked/raw call —
          // default to raw-as-entered, no retention, and flag it. Never scale.
          if (r.confidence < CONFIDENCE_THRESHOLD) {
            return {
              name: r.name,
              cookedState: "raw",
              retentionFactor: 1,
              confidence: r.confidence,
              flagged: true,
            };
          }
          return {
            name: r.name,
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
