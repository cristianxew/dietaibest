/**
 * TDD: meal-plan-workflow — entitlement error
 *
 * Happy skeleton + fanout, but createMealPlan throws QuotaExceededError
 * (simulating a Free user trying a 7-day plan).
 *
 * Asserts:
 * - workflow result.status === 'failed' with code QUOTA_EXCEEDED
 * - chat tool maps the error via toEntitlementError → { ok: false, reason: 'quota' }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolEmit } from "@/lib/chat/tools/types";
import {
  makeSkeletonModel,
  makeSuccessFanoutModel,
  make14Slots,
  makeCandidates,
  makeWorkflowInput,
} from "./_workflow-fixtures";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/actions/meal-plan", () => ({
  createMealPlan: vi.fn(),
}));

vi.mock("@/mastra/workflows/_llm", () => ({
  getSkeletonModel: vi.fn(),
  getFanoutModel: vi.fn(),
}));

// The chat tool loads the profile + candidate pool before starting the workflow.
vi.mock("@/lib/prisma", () => {
  const prisma = {
    userProfile: { findUnique: vi.fn() },
    recipe: { findMany: vi.fn() },
  };
  return { prisma, default: prisma };
});

import { createMealPlan } from "@/actions/meal-plan";
import prisma from "@/lib/prisma";
import { getSkeletonModel, getFanoutModel } from "@/mastra/workflows/_llm";
import { mastra } from "@/mastra";
import { generateMealPlan as generateMealPlanTool } from "@/lib/chat/tools/generateMealPlan";
import { QuotaExceededError } from "@/lib/entitlements";
import { RequestContext } from "@mastra/core/request-context";
import { makeCtx } from "./_fixtures";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateMealPlanWorkflow — entitlement error (Free user 7-day plan)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.recipe.findMany).mockResolvedValue(makeCandidates() as never);
  });

  it("workflow status is 'failed' with QUOTA_EXCEEDED code when createMealPlan throws", async () => {
    const slots = make14Slots();
    vi.mocked(getSkeletonModel).mockReturnValue(
      makeSkeletonModel(slots, "7-Day Entitlement Test") as never
    );
    vi.mocked(getFanoutModel).mockReturnValue(makeSuccessFanoutModel() as never);

    // Simulate Free user: createMealPlan throws QuotaExceededError
    vi.mocked(createMealPlan).mockRejectedValue(
      new QuotaExceededError("mealPlanDurationDays", 3, 7)
    );

    const emit: ToolEmit = vi.fn();
    const requestContext = new RequestContext();
    requestContext.set("emit" as never, emit as never);

    const workflow = mastra.getWorkflow("generateMealPlanWorkflow");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: makeWorkflowInput(),
      requestContext,
    });

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      // Mastra serializes errors to plain objects — check by code
      const err = result.error as unknown as Record<string, unknown>;
      expect(err?.code).toBe("QUOTA_EXCEEDED");
      expect(err?.quota).toBe("mealPlanDurationDays");
    }
  });

  it("chat tool maps QuotaExceededError → { ok: false, reason: 'quota', message with limit }", async () => {
    const slots = make14Slots();
    vi.mocked(getSkeletonModel).mockReturnValue(
      makeSkeletonModel(slots, "7-Day Entitlement Test") as never
    );
    vi.mocked(getFanoutModel).mockReturnValue(makeSuccessFanoutModel() as never);

    vi.mocked(createMealPlan).mockRejectedValue(
      new QuotaExceededError("mealPlanDurationDays", 3, 7)
    );

    const emit: ToolEmit = vi.fn();
    const ctx = makeCtx();

    const toolResult = await generateMealPlanTool.execute(
      { days: 7, mealsPerDay: ["breakfast", "dinner"] },
      ctx,
      emit
    );

    expect(toolResult.ok).toBe(false);
    if (!toolResult.ok) {
      expect(toolResult.reason).toBe("quota");
      expect(toolResult.message).toContain("3");
    }
  });
});
