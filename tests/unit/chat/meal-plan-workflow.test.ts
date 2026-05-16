/**
 * TDD: meal-plan-workflow — happy path
 *
 * 7-day × 2-meal plan. All 14 slots succeed.
 * Asserts workflow result shape and that createMealPlan is called with the
 * correct rolled-up days payload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolEmit } from "@/lib/chat/tools/types";
import { makeSkeletonModel, makeSuccessFanoutModel, make14Slots } from "./_workflow-fixtures";
import { makeCtx } from "./_fixtures";

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
import { generateMealPlan } from "@/lib/chat/tools/generateMealPlan";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateMealPlanWorkflow — happy path (7-day × 2-meal)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs all 3 steps and persists the plan with 0 failed slots", async () => {
    const slots = make14Slots();
    vi.mocked(getSkeletonModel).mockReturnValue(makeSkeletonModel(slots, "7-Day Test Plan") as never);
    vi.mocked(getFanoutModel).mockReturnValue(makeSuccessFanoutModel() as never);

    vi.mocked(createMealPlan).mockResolvedValue({
      data: { id: "mp-1", name: "7-Day Test Plan" } as never,
      error: null,
    } as never);

    const progressEvents: Array<{ statusKey: string; payload?: unknown }> = [];
    const emit: ToolEmit = (e) => progressEvents.push(e);

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

    const { mealPlanId, name, failedSlots } = result.result as {
      mealPlanId: string;
      name: string;
      failedSlots: number;
    };
    expect(mealPlanId).toBe("mp-1");
    expect(name).toBe("7-Day Test Plan");
    expect(failedSlots).toBe(0);

    // createMealPlan must be called exactly once
    expect(createMealPlan).toHaveBeenCalledTimes(1);

    const callArg = vi.mocked(createMealPlan).mock.calls[0][0] as {
      duration: number;
      days: Array<{
        dayNumber: number;
        meals: Array<{ recipeId: string | null; generationFailed: boolean }>;
      }>;
    };
    expect(callArg.duration).toBe(7);
    expect(callArg.days).toHaveLength(7);

    // Day 1 should have 2 meals with recipeIds (not null)
    const day1 = callArg.days.find((d) => d.dayNumber === 1);
    expect(day1).toBeDefined();
    expect(day1!.meals).toHaveLength(2);
    expect(day1!.meals[0].generationFailed).toBe(false);
    expect(day1!.meals[0].recipeId).toBeDefined();
    expect(day1!.meals[0].recipeId).not.toBeNull();

    // Progress events: 14 mealplan.slot + 1 mealplan.saving
    const slotEvents = progressEvents.filter((e) => e.statusKey === "mealplan.slot");
    expect(slotEvents).toHaveLength(14);
    const savingEvents = progressEvents.filter((e) => e.statusKey === "mealplan.saving");
    expect(savingEvents).toHaveLength(1);
  });
});

// ── Chat tool success-path ────────────────────────────────────────────────────

describe("generateMealPlan chat tool — success path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns ok=true with mealPlanId, failedSlots, and the mealplan link; emits planning status before delegating", async () => {
    const slots = make14Slots();
    vi.mocked(getSkeletonModel).mockReturnValue(makeSkeletonModel(slots, "7-Day Test Plan") as never);
    vi.mocked(getFanoutModel).mockReturnValue(makeSuccessFanoutModel() as never);

    vi.mocked(createMealPlan).mockResolvedValue({
      data: { id: "mp-1", name: "7-Day Test Plan" } as never,
      error: null,
    } as never);

    const emitCalls: Array<{ statusKey: string; payload?: unknown }> = [];
    const emit: ToolEmit = (e) => emitCalls.push(e);

    const ctx = makeCtx({ userId: "u1" });

    const result = await generateMealPlan.execute(
      { days: 7, mealsPerDay: ["breakfast", "dinner"] },
      ctx,
      emit
    );

    // ── Success shape ──────────────────────────────────────────────────────────
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toEqual({ mealPlanId: "mp-1", failedSlots: 0 });

    // ── Link shape (the UX contract) ───────────────────────────────────────────
    expect(result.link).toEqual({
      type: "mealplan",
      href: "/meal-plans?selected=mp-1",
      label: "7-Day Test Plan",
    });

    // ── mealplan.planning emitted BEFORE the workflow ran ──────────────────────
    const planningIdx = emitCalls.findIndex((e) => e.statusKey === "mealplan.planning");
    expect(planningIdx).toBe(0);

    // workflow slot events come after
    const slotEvents = emitCalls.filter((e) => e.statusKey === "mealplan.slot");
    expect(slotEvents.length).toBeGreaterThan(0);
    const firstSlotIdx = emitCalls.findIndex((e) => e.statusKey === "mealplan.slot");
    expect(firstSlotIdx).toBeGreaterThan(planningIdx);
  });
});
