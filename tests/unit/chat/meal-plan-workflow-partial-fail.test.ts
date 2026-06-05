/**
 * TDD: meal-plan-workflow — partial failure
 *
 * 14-slot plan (7 days × 2 meals). 2 slots fail with a permanent error.
 * Plan should still persist with those 2 slots marked generationFailed=true.
 * 2/14 = 14.3% which is below the 25% abort threshold.
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
import { RequestContext } from "@mastra/core/request-context";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateMealPlanWorkflow — partial failure (2/14 slots fail)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists the plan with 2 failed slots marked generationFailed=true", async () => {
    const slots = make14Slots();
    vi.mocked(getSkeletonModel).mockReturnValue(
      makeSkeletonModel(slots, "Partial Test Plan") as never
    );
    // Slots at call-index 2 and 7 fail
    vi.mocked(getFanoutModel).mockReturnValue(
      makeFailFanoutModel(new Set([2, 7])) as never
    );

    vi.mocked(createMealPlan).mockResolvedValue({
      data: { id: "mp-2", name: "Partial Test Plan" } as never,
      error: null,
    } as never);

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

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const { mealPlanId, failedSlots } = result.result as {
      mealPlanId: string;
      failedSlots: number;
    };
    expect(mealPlanId).toBe("mp-2");
    expect(failedSlots).toBe(2);

    // createMealPlan must still be called (2/14 < 25% threshold)
    expect(createMealPlan).toHaveBeenCalledTimes(1);

    const callArg = vi.mocked(createMealPlan).mock.calls[0][0] as {
      days: Array<{ meals: Array<{ generationFailed: boolean; recipeId: string | null; generationError?: string }> }>;
    };

    // Find the failed meals
    const allMeals = callArg.days.flatMap((d) => d.meals);
    const failedMeals = allMeals.filter((m) => m.generationFailed === true);
    expect(failedMeals).toHaveLength(2);

    for (const m of failedMeals) {
      expect(m.recipeId).toBeNull();
      expect(typeof m.generationError).toBe("string");
      expect(m.generationError!.length).toBeGreaterThan(0);
    }

    // Successful meals must have a real recipeId
    const succeededMeals = allMeals.filter((m) => !m.generationFailed);
    expect(succeededMeals).toHaveLength(12);
    for (const m of succeededMeals) {
      expect(m.recipeId).not.toBeNull();
    }

    // Progress events: 12 slot-ok + 2 slotFailed
    const emitMock = emit as ReturnType<typeof vi.fn>;
    const calls = emitMock.mock.calls as Array<[{ statusKey: string }]>;
    const slotOk = calls.filter((args) => args[0].statusKey === "mealplan.slot");
    const slotFailed = calls.filter((args) => args[0].statusKey === "mealplan.slotFailed");
    expect(slotOk).toHaveLength(12);
    expect(slotFailed).toHaveLength(2);
  });
});
