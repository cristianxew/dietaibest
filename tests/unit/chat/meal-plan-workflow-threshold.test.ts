/**
 * TDD: meal-plan-workflow — failure threshold exceeded
 *
 * 14-slot plan (7 days × 2 meals). 5 slots fail (5/14 = 35.7% > 25%).
 * Workflow must abort with PlanIncompleteError; createMealPlan must NOT be called.
 * The chat tool maps the error to { ok: false, reason: 'generic' }.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolEmit } from "@/lib/chat/tools/types";
import { makeSkeletonModel, makeFailFanoutModel, make14Slots } from "./_workflow-fixtures";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/actions/meal-plan", () => ({
  createMealPlan: vi.fn(),
}));

vi.mock("@/mastra/workflows/_llm", () => ({
  getSkeletonModel: vi.fn(),
  getFanoutModel: vi.fn(),
}));

import { createMealPlan } from "@/actions/meal-plan";
import { getSkeletonModel, getFanoutModel } from "@/mastra/workflows/_llm";
import { mastra } from "@/mastra";
import { generateMealPlan as generateMealPlanTool } from "@/lib/chat/tools/generateMealPlan";
import { RequestContext } from "@mastra/core/request-context";
import { makeCtx } from "./_fixtures";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateMealPlanWorkflow — threshold exceeded (5/14 fail → abort)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("aborts with PlanIncompleteError code and does NOT call createMealPlan", async () => {
    const slots = make14Slots();
    vi.mocked(getSkeletonModel).mockReturnValue(
      makeSkeletonModel(slots, "Threshold Test Plan") as never
    );
    // 5 out of 14 slots fail (indices 0, 3, 6, 9, 12)
    vi.mocked(getFanoutModel).mockReturnValue(
      makeFailFanoutModel(new Set([0, 3, 6, 9, 12])) as never
    );

    const emit: ToolEmit = vi.fn();
    const requestContext = new RequestContext();
    requestContext.set("emit" as never, emit as never);

    const workflow = mastra.getWorkflow("generateMealPlanWorkflow");
    const run = await workflow.createRun();
    const result = await run.start({
      inputData: {
        days: 7,
        mealsPerDay: ["breakfast", "dinner"],
        userId: "u1",
      },
      requestContext,
    });

    // Workflow must fail
    expect(result.status).toBe("failed");

    // createMealPlan must NOT be called
    expect(createMealPlan).not.toHaveBeenCalled();

    // The error must be PlanIncompleteError (Mastra serializes to plain object — check code)
    if (result.status === "failed") {
      const err = result.error as unknown as Record<string, unknown>;
      expect(err?.code).toBe("PLAN_INCOMPLETE");
      expect(err?.failed).toBe(5);
      expect(err?.total).toBe(14);
    }
  });

  it("chat tool maps PlanIncompleteError to { ok: false, reason: 'generic' }", async () => {
    const slots = make14Slots();
    vi.mocked(getSkeletonModel).mockReturnValue(
      makeSkeletonModel(slots, "Threshold Test Plan") as never
    );
    vi.mocked(getFanoutModel).mockReturnValue(
      makeFailFanoutModel(new Set([0, 3, 6, 9, 12])) as never
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
      expect(toolResult.reason).toBe("generic");
      expect(toolResult.message).toContain("Plan incomplete");
      expect(toolResult.message).toContain("5");
      expect(toolResult.message).toContain("14");
    }
  });
});
