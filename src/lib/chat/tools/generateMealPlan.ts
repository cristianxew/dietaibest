/**
 * generateMealPlan chat tool — DIE-37 Task 4
 *
 * Orchestrates the 3-step Mastra workflow (skeleton → fanout → persist)
 * and streams per-slot progress back to the client via `emit`.
 *
 * Before starting the workflow the tool:
 *   - merges the request with the user's profile (calorie/macro targets,
 *     dietary preferences, allergies) — explicit input wins;
 *   - loads the candidate recipe pool the fanout step may select from, and
 *     fails fast (no tokens spent) when that pool is empty.
 *
 * IMPORTANT: Mastra serializes thrown errors to plain objects before placing
 * them in `result.error` — `instanceof` checks won't work. We match on the
 * `code` property instead (each error class sets `readonly code = '...'`).
 */
import { z } from "zod";
import { RequestContext } from "@mastra/core/request-context";
import { mastra } from "@/mastra";
import { NoCandidateRecipesError } from "@/mastra/workflows/_errors";
import { toEntitlementError } from "@/lib/entitlement-error";
import { loadCandidateRecipes } from "@/lib/meal-plan/generation-candidates";
import {
  loadGenerationProfile,
  mergeGenerationTargets,
} from "@/lib/meal-plan/generation-profile";
import type { Tool, ToolEmit } from "./types";

const inputSchema = z.object({
  days: z.number().int().min(1).max(14),
  targetCalories: z.number().positive().optional(),
  targetProtein: z.number().positive().optional(),
  targetCarbs: z.number().positive().optional(),
  targetFat: z.number().positive().optional(),
  dietary: z.array(z.string()).optional(),
  // A persisted template needs at least 2 meal slots (mealPlanTemplateFormSchema).
  mealsPerDay: z
    .array(z.enum(["breakfast", "lunch", "dinner", "snack"]))
    .min(2)
    .optional(),
});

const NO_RECIPES_MESSAGE = new NoCandidateRecipesError().message;

// ── Serialised-error helpers ──────────────────────────────────────────────────

type SerializedError = Record<string, unknown>;

function getCode(err: unknown): string | undefined {
  if (err && typeof err === "object") {
    return (err as SerializedError)["code"] as string | undefined;
  }
  return undefined;
}

/**
 * Mastra serializes errors to plain objects; toEntitlementError uses instanceof.
 * This helper checks by code instead so it works with serialised shapes.
 */
function toEntitlementPayload(
  err: unknown
): { ok: false; reason: "quota"; message: string } | null {
  // First try instanceof (direct throw path)
  const direct = toEntitlementError(err);
  if (direct) {
    return {
      ok: false,
      reason: "quota",
      message:
        direct.code === "PRO_ONLY"
          ? "Requires Pro"
          : `Limit ${(direct as { limit: number }).limit} reached`,
    };
  }

  // Then try serialized code path (Mastra result.error shape)
  const code = getCode(err);
  if (code === "PRO_ONLY") {
    return { ok: false, reason: "quota", message: "Requires Pro" };
  }
  if (code === "QUOTA_EXCEEDED") {
    const limit = (err as SerializedError)["limit"] as number | undefined;
    return {
      ok: false,
      reason: "quota",
      message: limit !== undefined ? `Limit ${limit} reached` : "Quota exceeded",
    };
  }
  return null;
}

// ── Tool definition ───────────────────────────────────────────────────────────

export const generateMealPlan: Tool<
  typeof inputSchema,
  { mealPlanId: string; failedSlots: number }
> = {
  name: "generateMealPlan",
  description:
    "Generate a complete meal plan for N days from the user's saved recipes. " +
    "Uses a 3-step AI workflow: plans a skeleton, then assigns a saved recipe to " +
    "each slot in parallel. Profile calorie/macro targets, dietary preferences and " +
    "allergies are applied automatically. Streams progress as each slot is resolved.",
  guidance:
    "generateMealPlan only assigns recipes the user already saved (own recipes + " +
    "favorites). Do NOT ask the user for calorie or macro targets — their profile " +
    "targets and allergies are applied automatically; pass targets only when the " +
    "user states them in the conversation. If it fails because the user has no " +
    "saved recipes, suggest importing or creating a few recipes first.",
  inputSchema,
  statusKey: "mealplan.generating",
  requiresFeature: "aiMealPlan",

  async execute(input, ctx, emit?: ToolEmit) {
    // Signal to the UI that we're starting the planning phase
    emit?.({ statusKey: "mealplan.planning" });

    const profile = await loadGenerationProfile(ctx.userId);
    const targets = mergeGenerationTargets(input, profile);
    const candidates = await loadCandidateRecipes(ctx.userId, {
      allergies: targets.allergies,
    });

    if (candidates.length === 0) {
      return { ok: false, reason: "generic" as const, message: NO_RECIPES_MESSAGE };
    }

    const requestContext = new RequestContext();
    // RequestContext is generic — use `as never` to bypass strict key typing
    requestContext.set("emit" as never, emit as never);

    const workflow = mastra.getWorkflow("generateMealPlanWorkflow");
    const run = await workflow.createRun();

    let result: Awaited<ReturnType<typeof run.start>>;
    try {
      result = await run.start({
        inputData: {
          days: input.days,
          mealsPerDay: input.mealsPerDay,
          ...targets,
          userId: ctx.userId,
          candidates,
        },
        requestContext,
      });
    } catch (err) {
      // Mastra threw synchronously (unusual, but handle it)
      const entPayload = toEntitlementPayload(err);
      if (entPayload) return entPayload;
      return {
        ok: false,
        reason: "generic" as const,
        message: (err as Error)?.message ?? "Workflow failed",
      };
    }

    if (result.status !== "success") {
      // Extract the error — Mastra wraps it in result.error when status === 'failed'
      const err =
        result.status === "failed" ? (result.error as unknown) : undefined;

      // Entitlement errors (QuotaExceededError / ProOnlyError)
      const entPayload = toEntitlementPayload(err);
      if (entPayload) return entPayload;

      // PlanIncompleteError — check by code since Mastra serializes
      const code = getCode(err);
      if (code === "PLAN_INCOMPLETE") {
        const failed = (err as SerializedError)["failed"] as number;
        const total = (err as SerializedError)["total"] as number;
        return {
          ok: false,
          reason: "generic" as const,
          message: `Plan incomplete: ${failed}/${total} slots failed`,
        };
      }

      if (code === "SKELETON_FAILED") {
        return {
          ok: false,
          reason: "generic" as const,
          message: "Could not generate plan skeleton",
        };
      }

      if (code === "NO_RECIPES") {
        return { ok: false, reason: "generic" as const, message: NO_RECIPES_MESSAGE };
      }

      return {
        ok: false,
        reason: "generic" as const,
        message: (err as Error)?.message ?? "Workflow failed",
      };
    }

    const { mealPlanId, name, failedSlots } = result.result as {
      mealPlanId: string;
      name: string;
      failedSlots: number;
    };

    return {
      ok: true,
      data: { mealPlanId, failedSlots },
      link: {
        type: "mealplan" as const,
        href: `/meal-plans?selected=${mealPlanId}`,
        label: name,
      },
    };
  },
};
