/**
 * generateMealPlan chat tool — DIE-37 Task 4
 *
 * Orchestrates the 3-step Mastra workflow (skeleton → fanout → persist)
 * and streams per-slot progress back to the client via `emit`.
 *
 * IMPORTANT: Mastra serializes thrown errors to plain objects before placing
 * them in `result.error` — `instanceof` checks won't work. We match on the
 * `code` property instead (each error class sets `readonly code = '...'`).
 */
import { z } from "zod";
import { RequestContext } from "@mastra/core/request-context";
import { mastra } from "@/mastra";
import { toEntitlementError } from "@/lib/entitlement-error";
import type { Tool, ToolEmit } from "./types";

const inputSchema = z.object({
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
});

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
    "Generate a complete meal plan for N days with macro targets. " +
    "Uses a 3-step AI workflow: plans a skeleton then fills recipes in parallel. " +
    "Streams progress as each slot is resolved.",
  inputSchema,
  statusKey: "mealplan.generating",
  requiresFeature: "aiChat",

  async execute(input, ctx, emit?: ToolEmit) {
    // Signal to the UI that we're starting the planning phase
    emit?.({ statusKey: "mealplan.planning" });

    const requestContext = new RequestContext();
    // RequestContext is generic — use `as never` to bypass strict key typing
    requestContext.set("emit" as never, emit as never);

    const workflow = mastra.getWorkflow("generateMealPlanWorkflow");
    const run = await workflow.createRun();

    let result: Awaited<ReturnType<typeof run.start>>;
    try {
      result = await run.start({
        inputData: { ...input, userId: ctx.userId },
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
