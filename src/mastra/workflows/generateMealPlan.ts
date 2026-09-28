/**
 * generateMealPlanWorkflow — DIE-37 Task 4
 *
 * 3-step Mastra workflow:
 *   1. skeletonStep  — Sonnet 4.6 generates a meal plan skeleton (slots with brief descriptions)
 *   2. fanoutStep    — Haiku 4.5 picks, for each slot in parallel (concurrency=8), ONE recipe
 *                      from the user's candidate library by index; the server maps the index
 *                      back to a real recipe id. The model never produces an id itself.
 *   3. persistStep   — 25% threshold check → createMealPlan action
 *
 * The candidate pool (own recipes + favorited public recipes) and the merged
 * profile targets/allergies are loaded by the chat tool and passed in as
 * workflow input, so the workflow stays pure orchestration.
 */
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { generateObject } from "ai";
import { z } from "zod";
import { createMealPlan } from "@/actions/meal-plan";
import {
  formatCandidatesForPrompt,
  pickCandidate,
  type CandidateRecipe,
} from "@/lib/meal-plan/generation-candidates";
import { getSkeletonModel, getFanoutModel } from "./_llm";
import {
  SkeletonFailedError,
  PlanIncompleteError,
  NoCandidateRecipesError,
} from "./_errors";
import type { ToolEmit } from "@/lib/chat/tools/types";

// ── Re-export errors for consumers ─────────────────────────────────────────
export {
  SkeletonFailedError,
  PlanIncompleteError,
  NoCandidateRecipesError,
} from "./_errors";

// ── Shared schemas ──────────────────────────────────────────────────────────

/** Meal types the generator accepts — a subset of `mealTypeEnum` in src/types/meal-plan.ts. */
export const GENERATOR_MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;
type GeneratorMealType = (typeof GENERATOR_MEAL_TYPES)[number];

const DEFAULT_MEAL_TYPES: GeneratorMealType[] = ["breakfast", "dinner"];

const candidateSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  calories: z.number().nullable().optional(),
  protein: z.number().nullable().optional(),
  carbs: z.number().nullable().optional(),
  fat: z.number().nullable().optional(),
});

const workflowInputSchema = z.object({
  days: z.number().int().min(1).max(14),
  targetCalories: z.number().positive().optional(),
  targetProtein: z.number().positive().optional(),
  targetCarbs: z.number().positive().optional(),
  targetFat: z.number().positive().optional(),
  dietary: z.array(z.string()).optional(),
  /** Hard exclusions (from the profile). */
  allergies: z.array(z.string()).optional(),
  // min(2) mirrors mealPlanTemplateFormSchema.mealSlots — a 1-meal plan can't persist.
  mealsPerDay: z.array(z.enum(GENERATOR_MEAL_TYPES)).min(2).optional(),
  userId: z.string(),
  /** Recipes the fanout step may choose from. Empty → NoCandidateRecipesError. */
  candidates: z.array(candidateSchema),
});

type WorkflowInput = z.infer<typeof workflowInputSchema>;

const slotSchema = z.object({
  day: z.number().int().min(1),
  mealType: z.string(),
  brief: z.string(),
});

const skeletonOutputSchema = z.object({
  slots: z.array(slotSchema),
  planName: z.string(),
});

const resolvedSlotSchema = z.object({
  day: z.number().int().min(1),
  mealType: z.string(),
  brief: z.string(),
  recipeId: z.string().nullable(),
  generationFailed: z.boolean(),
  generationError: z.string().optional(),
});

const fanoutOutputSchema = z.object({
  resolvedSlots: z.array(resolvedSlotSchema),
  failedCount: z.number().int().min(0),
  planName: z.string(),
});

const persistOutputSchema = z.object({
  mealPlanId: z.string(),
  name: z.string(),
  failedSlots: z.number().int().min(0),
});

// ── Utilities ────────────────────────────────────────────────────────────────

/**
 * Minimal in-process concurrency limiter — same semantics as p-limit.
 * Kept inline to avoid extra deps. cap=8 for the fanout step.
 */
function createLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= max) return;
    const task = queue.shift();
    if (task) {
      active++;
      task();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then((v) => {
            active--;
            next();
            resolve(v);
          })
          .catch((e) => {
            active--;
            next();
            reject(e);
          });
      };
      queue.push(run);
      next();
    });
}

/**
 * Returns true for transient/retriable errors only.
 * Permanent validation errors should fail immediately.
 */
function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;

  // @ai-sdk/provider's APICallError exposes `isRetryable` covering HTTP 408/409/429/≥500.
  if (e["isRetryable"] === true) return true;

  // Node.js network errors + aborts.
  const code = e["code"] as string | undefined;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ENOTFOUND") return true;

  const name = e["name"] as string | undefined;
  if (name === "AbortError") return true;

  return false;
}

/**
 * Sleep helper for exponential backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveMealTypes(mealsPerDay: WorkflowInput["mealsPerDay"]): GeneratorMealType[] {
  return mealsPerDay?.length ? mealsPerDay : DEFAULT_MEAL_TYPES;
}

/** Workflow input candidates → the shape the prompt formatter expects. */
function toCandidateRecipes(candidates: WorkflowInput["candidates"]): CandidateRecipe[] {
  return candidates.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description ?? null,
    tags: c.tags ?? [],
    calories: c.calories ?? null,
    protein: c.protein ?? null,
    carbs: c.carbs ?? null,
    fat: c.fat ?? null,
  }));
}

function constraintLines(input: {
  dietary?: string[];
  allergies?: string[];
}): string[] {
  const lines: string[] = [];
  if (input.allergies?.length) {
    lines.push(
      `ALLERGIES — never choose or suggest anything containing: ${input.allergies.join(", ")}.`
    );
  }
  if (input.dietary?.length) {
    lines.push(`Dietary preferences: ${input.dietary.join(", ")}.`);
  }
  return lines;
}

/**
 * Ask the fanout model to pick ONE candidate (by index) for a slot.
 * The answer is validated twice: by the per-call schema bounds and by
 * `pickCandidate`, so an invalid pick fails the slot instead of leaking a
 * fake id downstream.
 *
 * 1 retry: on transient errors only, 1s backoff.
 */
async function resolveSlot(
  slot: { day: number; mealType: string; brief: string },
  slotIndex: number,
  ctx: {
    candidates: CandidateRecipe[];
    dietary?: string[];
    allergies?: string[];
    perMealCalories?: number;
  }
): Promise<string> {
  const model = getFanoutModel();
  const { candidates } = ctx;

  const pickSchema = z.object({
    index: z
      .number()
      .int()
      .min(0)
      .max(candidates.length - 1)
      .describe("The #index of the chosen recipe from the candidate list"),
  });

  const system = [
    "You assign a recipe from the user's saved library to one meal slot of a meal plan.",
    "You MUST answer with the #index of exactly one recipe from the CANDIDATES list below.",
    "Never invent recipes or indices that are not in the list.",
    "Prefer the first suitable recipe you find; avoid obviously wrong meal types (e.g. a dessert for breakfast only if nothing else fits).",
    ...constraintLines(ctx),
    "",
    "CANDIDATES (index, title, per-serving macros, tags):",
    formatCandidatesForPrompt(candidates, slotIndex),
  ].join("\n");

  const prompt =
    `Slot: Day ${slot.day}, ${slot.mealType} — "${slot.brief}". ` +
    (ctx.perMealCalories
      ? `Aim for roughly ${Math.round(ctx.perMealCalories)} kcal for this meal. `
      : "") +
    `Return the #index of the best matching recipe.`;

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      if (!isTransient(lastError)) {
        // Permanent error — fail immediately, no retry
        throw lastError;
      }
      await sleep(1000);
    }

    try {
      const result = await generateObject({
        model,
        schema: pickSchema,
        system,
        prompt,
        maxRetries: 0, // we handle retries ourselves
      });

      const chosen = pickCandidate(candidates, result.object.index);
      if (!chosen) {
        throw new Error(`Model picked an invalid candidate index: ${result.object.index}`);
      }
      return chosen.id;
    } catch (err) {
      lastError = err;
      if (attempt === 0 && !isTransient(err)) {
        // Non-retriable — throw immediately
        throw err;
      }
    }
  }

  throw lastError;
}

/**
 * Group resolved slots by day and shape them for createMealPlan's `days` array.
 */
function rollupDaysFromResolvedSlots(
  resolvedSlots: Array<{
    day: number;
    mealType: string;
    recipeId: string | null;
    generationFailed: boolean;
    generationError?: string;
  }>
): Array<{
  dayNumber: number;
  meals: Array<{
    recipeId: string | null;
    mealType: string;
    servings: 1;
    sortOrder: number;
    generationFailed: boolean;
    generationError?: string;
  }>;
}> {
  const dayMap = new Map<
    number,
    Array<{
      recipeId: string | null;
      mealType: string;
      servings: 1;
      sortOrder: number;
      generationFailed: boolean;
      generationError?: string;
    }>
  >();

  for (const slot of resolvedSlots) {
    if (!dayMap.has(slot.day)) dayMap.set(slot.day, []);
    const meals = dayMap.get(slot.day)!;
    const meal: {
      recipeId: string | null;
      mealType: string;
      servings: 1;
      sortOrder: number;
      generationFailed: boolean;
      generationError?: string;
    } = {
      recipeId: slot.recipeId,
      mealType: slot.mealType,
      servings: 1,
      sortOrder: meals.length,
      generationFailed: slot.generationFailed,
    };
    if (slot.generationError !== undefined) {
      meal.generationError = slot.generationError;
    }
    meals.push(meal);
  }

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayNumber, meals]) => ({ dayNumber, meals }));
}

// ── Step 1: skeleton ─────────────────────────────────────────────────────────

const skeletonStep = createStep({
  id: "skeleton",
  inputSchema: workflowInputSchema,
  outputSchema: skeletonOutputSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute({ inputData }: any) {
    const input = inputData as WorkflowInput;
    const {
      days,
      dietary,
      allergies,
      targetCalories,
      targetProtein,
      targetCarbs,
      targetFat,
      candidates,
    } = input;

    // Defense in depth — the chat tool already fails fast, but a direct
    // workflow caller must not spend a Sonnet call on an unfillable plan.
    if (!candidates?.length) {
      throw new NoCandidateRecipesError();
    }

    const model = getSkeletonModel();
    const mealTypes = resolveMealTypes(input.mealsPerDay);

    // Constrain the model to the requested meal types so persist never sees a
    // value outside mealTypeEnum ("Breakfast", "morning snack", …).
    const perRunSkeletonSchema = z.object({
      slots: z.array(
        z.object({
          day: z.number().int().min(1).max(days),
          mealType: z.enum([mealTypes[0], ...mealTypes.slice(1)] as [
            GeneratorMealType,
            ...GeneratorMealType[],
          ]),
          brief: z.string(),
        })
      ),
      // mealPlanTemplateFormSchema.name is min(3).max(100)
      planName: z.string().min(3).max(100),
    });

    const macroHint = [
      targetCalories ? `${targetCalories} kcal/day` : "",
      targetProtein ? `${targetProtein}g protein` : "",
      targetCarbs ? `${targetCarbs}g carbs` : "",
      targetFat ? `${targetFat}g fat` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const systemPrompt = [
      "You are a meal plan architect. Given target macros and constraints, " +
        "produce a balanced N-day plan as a list of meal slots with brief meal ideas.",
      "Each slot will later be matched to ONE recipe from the user's saved recipe library, " +
        "so keep briefs generic (e.g. \"high-protein oat breakfast\") rather than naming exotic dishes.",
      ...constraintLines({ dietary, allergies }),
    ].join("\n");

    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        if (!isTransient(lastError)) break; // permanent — don't waste latency on retries
        await sleep(Math.pow(2, attempt - 1) * 1000); // 1s, 2s
      }

      try {
        const result = await generateObject({
          model,
          system: systemPrompt,
          prompt:
            `Create a ${days}-day meal plan with exactly these meals per day: ${mealTypes.join(", ")}. ` +
            (macroHint ? `Target macros: ${macroHint}. ` : "") +
            `Return an object with "planName" (string, 3-100 chars) and "slots" ` +
            `(one entry per day per meal type: { day, mealType, brief }).`,
          schema: perRunSkeletonSchema,
          maxRetries: 0,
        });

        return result.object;
      } catch (err) {
        lastError = err;
      }
    }

    throw new SkeletonFailedError(lastError);
  },
});

// ── Step 2: fanout ───────────────────────────────────────────────────────────

const fanoutStep = createStep({
  id: "fanout",
  inputSchema: skeletonOutputSchema,
  outputSchema: fanoutOutputSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute({ inputData, requestContext, getInitData }: any) {
    const emit = requestContext.get("emit") as ToolEmit | undefined;
    const initData = getInitData() as WorkflowInput;
    const candidates = toCandidateRecipes(initData.candidates);
    const mealTypes = resolveMealTypes(initData.mealsPerDay);
    const perMealCalories = initData.targetCalories
      ? initData.targetCalories / mealTypes.length
      : undefined;

    const slots = (inputData.slots as Array<{ day: number; mealType: string; brief: string }>);
    const limit = createLimiter(8);

    const results = await Promise.all(
      slots.map((slot, i) =>
        limit(async () => {
          try {
            const recipeId = await resolveSlot(slot, i, {
              candidates,
              dietary: initData.dietary,
              allergies: initData.allergies,
              perMealCalories,
            });
            emit?.({
              statusKey: "mealplan.slot",
              payload: { slot: { n: i + 1, m: slots.length } },
            });
            return {
              day: slot.day,
              mealType: slot.mealType,
              brief: slot.brief,
              recipeId,
              generationFailed: false as const,
            };
          } catch (err) {
            emit?.({
              statusKey: "mealplan.slotFailed",
              payload: {
                failedSlot: { day: slot.day, meal: slot.mealType },
              },
            });
            return {
              day: slot.day,
              mealType: slot.mealType,
              brief: slot.brief,
              recipeId: null as null,
              generationFailed: true as const,
              generationError: String((err as Error)?.message ?? err),
            };
          }
        })
      )
    );

    const failedCount = results.filter((r) => r.generationFailed).length;

    return {
      resolvedSlots: results,
      failedCount,
      planName: (inputData.planName as string),
    };
  },
});

// ── Step 3: persist ──────────────────────────────────────────────────────────

const persistStep = createStep({
  id: "persist",
  inputSchema: fanoutOutputSchema,
  outputSchema: persistOutputSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async execute({ inputData, requestContext, getInitData }: any) {
    const emit = requestContext.get("emit") as ToolEmit | undefined;
    const initData = getInitData() as WorkflowInput;

    const resolvedSlots = inputData.resolvedSlots as Array<{
      day: number;
      mealType: string;
      recipeId: string | null;
      generationFailed: boolean;
      generationError?: string;
    }>;
    const failedCount = inputData.failedCount as number;
    const planName = inputData.planName as string;
    const total = resolvedSlots.length;

    // 25% threshold check — if too many failed, abort without persisting
    if (failedCount / total >= 0.25) {
      throw new PlanIncompleteError(failedCount, total);
    }

    emit?.({ statusKey: "mealplan.saving" });

    const days = rollupDaysFromResolvedSlots(resolvedSlots);

    const result = await createMealPlan({
      name: planName,
      duration: initData.days,
      mealSlots: resolveMealTypes(initData.mealsPerDay),
      targetCalories: initData.targetCalories,
      targetProtein: initData.targetProtein,
      targetCarbs: initData.targetCarbs,
      targetFat: initData.targetFat,
      days,
      // required fields with defaults
      isPublic: false,
    } as never);

    // The serverAction wrapper returns { data, error }
    const actionResult = result as { data: { id: string; name: string } | null; error: unknown };
    if (actionResult.error || !actionResult.data) {
      throw new Error(
        typeof actionResult.error === "string"
          ? actionResult.error
          : "Failed to persist meal plan"
      );
    }

    return {
      mealPlanId: actionResult.data.id,
      name: actionResult.data.name,
      failedSlots: failedCount,
    };
  },
});

// ── Workflow assembly ────────────────────────────────────────────────────────

export const generateMealPlanWorkflow = createWorkflow({
  id: "generateMealPlanWorkflow",
  inputSchema: workflowInputSchema,
  outputSchema: persistOutputSchema,
})
  .then(skeletonStep)
  .then(fanoutStep)
  .then(persistStep)
  .commit();
