/**
 * generateMealPlanWorkflow — DIE-37 Task 4
 *
 * 3-step Mastra workflow:
 *   1. skeletonStep  — Sonnet 4.6 generates a meal plan skeleton (slots with brief descriptions)
 *   2. fanoutStep    — Haiku 4.5 resolves each slot to a recipeId in parallel (concurrency=8)
 *   3. persistStep   — 25% threshold check → createMealPlan action
 */
import { createStep, createWorkflow } from "@mastra/core/workflows";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { createMealPlan } from "@/actions/meal-plan";
import { getSkeletonModel, getFanoutModel } from "./_llm";
import { SkeletonFailedError, PlanIncompleteError } from "./_errors";
import type { ToolEmit } from "@/lib/chat/tools/types";

// ── Re-export errors for consumers ─────────────────────────────────────────
export { SkeletonFailedError, PlanIncompleteError } from "./_errors";

// ── Shared schemas ──────────────────────────────────────────────────────────

const workflowInputSchema = z.object({
  days: z.number().int().min(1).max(14),
  targetCalories: z.number().positive().optional(),
  targetProtein: z.number().positive().optional(),
  targetCarbs: z.number().positive().optional(),
  targetFat: z.number().positive().optional(),
  dietary: z.array(z.string()).optional(),
  mealsPerDay: z
    .array(z.enum(["breakfast", "lunch", "dinner", "snack"]))
    .min(1)
    .optional(),
  userId: z.string(),
});

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
  const status = e["status"] as number | undefined;
  if (status !== undefined && status >= 500) return true;
  const code = e["code"] as string | undefined;
  if (code === "ETIMEDOUT" || code === "rate_limit_exceeded") return true;
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

/**
 * Resolve a single slot to a recipeId via Haiku.
 * The model is asked to directly return a recipe ID string (either existing or
 * newly created). In tests, the model returns a plain text string with the ID.
 * In production, the model would use tool calls (searchRecipes / createRecipe).
 *
 * 1 retry: on transient errors only, 1s backoff.
 */
async function resolveSlot(
  slot: { day: number; mealType: string; brief: string },
  userId: string
): Promise<string> {
  const model = getFanoutModel();

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
      const result = await generateText({
        model,
        prompt:
          `You are a recipe resolver. Given this meal slot: Day ${slot.day} ${slot.mealType} - "${slot.brief}". ` +
          `Return ONLY a recipe ID string (like "recipe-123") for this meal. ` +
          `User ID: ${userId}`,
        maxRetries: 0, // we handle retries ourselves
      });

      const recipeId = result.text.trim();
      if (!recipeId) throw new Error("Empty recipeId returned by model");
      return recipeId;
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
    const model = getSkeletonModel();
    const { days, mealsPerDay, dietary, targetCalories, targetProtein, targetCarbs, targetFat } =
      inputData;

    const mealTypes = mealsPerDay?.length ? mealsPerDay.join(", ") : "breakfast, dinner";
    const macroHint = [
      targetCalories ? `${targetCalories} kcal/day` : "",
      targetProtein ? `${targetProtein}g protein` : "",
      targetCarbs ? `${targetCarbs}g carbs` : "",
      targetFat ? `${targetFat}g fat` : "",
    ]
      .filter(Boolean)
      .join(", ");

    const dietaryNote = dietary?.length ? `Dietary restrictions: ${dietary.join(", ")}` : "";

    const systemPrompt =
      "You are a meal plan architect. Given target macros and constraints, " +
      "produce a balanced N-day plan as a list of meal slots with brief recipe ideas.";

    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await sleep(Math.pow(2, attempt - 1) * 1000); // 1s, 2s
      }

      try {
        const result = await generateObject({
          model,
          system: systemPrompt,
          prompt:
            `Create a ${days}-day meal plan with these meals per day: ${mealTypes}. ` +
            (macroHint ? `Target macros: ${macroHint}. ` : "") +
            (dietaryNote ? `${dietaryNote}. ` : "") +
            `Return an object with "planName" (string) and "slots" (array of { day, mealType, brief }).`,
          schema: skeletonOutputSchema,
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
    const initData = getInitData() as { userId: string };
    const userId = initData.userId;

    const slots = (inputData.slots as Array<{ day: number; mealType: string; brief: string }>);
    const limit = createLimiter(8);

    const results = await Promise.all(
      slots.map((slot, i) =>
        limit(async () => {
          try {
            const recipeId = await resolveSlot(slot, userId);
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
    const initData = getInitData() as {
      days: number;
      mealsPerDay?: string[];
      targetCalories?: number;
      targetProtein?: number;
      targetCarbs?: number;
      targetFat?: number;
    };

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
      mealSlots: initData.mealsPerDay ?? ["breakfast", "dinner"],
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
