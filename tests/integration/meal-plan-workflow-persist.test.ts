/**
 * Integration: generateMealPlan chat tool → Mastra workflow → REAL createMealPlan.
 *
 * Unlike tests/unit/chat/meal-plan-workflow*.test.ts, this file does NOT mock
 * `@/actions/meal-plan`. The real `serverAction` runtime and the real
 * `mealPlanTemplateFormSchema` (recipeId must be a UUID) run. Only the
 * boundaries that need a Next request or a database are faked:
 *   - next-auth        → session for the test user
 *   - next/cache       → revalidatePath no-op
 *   - @/lib/prisma     → in-memory Prisma client double
 *   - _llm             → fake skeleton / fanout models
 *
 * Regression for: fanout step returned model-invented ids ("recipe-123") that
 * createMealPlan rejected with "Invalid input: Invalid uuid" on every real run.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { MockLanguageModelV3 } from "ai/test";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    userProfile: { findUnique: vi.fn() },
    recipe: { count: vi.fn(), findMany: vi.fn() },
    mealPlanTemplate: { count: vi.fn(), create: vi.fn() },
  };
  return { prisma, default: prisma };
});
vi.mock("@/mastra/workflows/_llm", () => ({
  getSkeletonModel: vi.fn(),
  getFanoutModel: vi.fn(),
}));

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { getSkeletonModel, getFanoutModel } from "@/mastra/workflows/_llm";
import { generateMealPlan } from "@/lib/chat/tools/generateMealPlan";
import { makeTextResult } from "../unit/chat/_workflow-fixtures";
import { makeCtx } from "../unit/chat/_fixtures";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const USER_ID = randomUUID();
const USER_EMAIL = "planner@test.local";
const PLAN_ID = randomUUID();

const proUser = {
  id: USER_ID,
  email: USER_EMAIL,
  plan: "pro",
  subscriptionStatus: "active",
};

function makeCandidates(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: randomUUID(),
    userId: USER_ID,
    title: `Library recipe ${i + 1}`,
    description: null,
    tags: [],
    calories: 450 + i * 10,
    protein: 30,
    carbs: 40,
    fat: 15,
    servings: 2,
    isPublic: false,
  }));
}

/** 2 days × 2 meals = 4 slots */
function makeSkeleton(planName: string) {
  const slots: Array<{ day: number; mealType: string; brief: string }> = [];
  for (let d = 1; d <= 2; d++) {
    slots.push({ day: d, mealType: "breakfast", brief: `Day ${d} breakfast` });
    slots.push({ day: d, mealType: "dinner", brief: `Day ${d} dinner` });
  }
  return new MockLanguageModelV3({
    provider: "fake",
    modelId: "fake-skeleton",
    doGenerate: async () => makeTextResult(JSON.stringify({ slots, planName })),
  });
}

/**
 * Fanout model that answers with a structured candidate index. `indices` is
 * consumed in call order; when exhausted it cycles from the start.
 */
function makeIndexFanout(indices: number[]) {
  let call = 0;
  return new MockLanguageModelV3({
    provider: "fake",
    modelId: "fake-fanout",
    doGenerate: async () =>
      makeTextResult(JSON.stringify({ index: indices[call++ % indices.length] })),
  });
}

type CreateArgs = {
  data: {
    name: string;
    targetCalories?: number;
    targetProtein?: number;
    targetCarbs?: number;
    targetFat?: number;
    days: {
      create: Array<{
        dayNumber: number;
        meals?: {
          create: Array<{
            recipeId: string | null;
            generationFailed: boolean;
          }>;
        };
      }>;
    };
  };
};

function persistedMeals() {
  const args = vi.mocked(prisma.mealPlanTemplate.create).mock
    .calls[0]?.[0] as unknown as CreateArgs | undefined;
  return args?.data.days.create.flatMap((d) => d.meals?.create ?? []) ?? [];
}

function seedDatabase(candidates: ReturnType<typeof makeCandidates>) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: USER_EMAIL },
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(proUser as never);
  vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null);
  // Serves both the candidate-pool query and createMealPlan's visibility
  // check (`where.id.in`), so only ids from the seeded library resolve.
  vi.mocked(prisma.recipe.findMany).mockImplementation((async (args: {
    where?: { id?: { in?: string[] } };
  }) => {
    const ids = args?.where?.id?.in;
    return ids ? candidates.filter((c) => ids.includes(c.id)) : candidates;
  }) as never);
  vi.mocked(prisma.recipe.count).mockResolvedValue(candidates.length);
  vi.mocked(prisma.mealPlanTemplate.count).mockResolvedValue(0);
  vi.mocked(prisma.mealPlanTemplate.create).mockImplementation((async (
    args: CreateArgs
  ) => ({
    id: PLAN_ID,
    name: args.data.name,
    days: [],
  })) as never);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("generateMealPlan → real createMealPlan contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a plan whose recipe ids all come from the user's library", async () => {
    const candidates = makeCandidates(4);
    seedDatabase(candidates);
    vi.mocked(getSkeletonModel).mockReturnValue(makeSkeleton("Library Plan") as never);
    vi.mocked(getFanoutModel).mockReturnValue(makeIndexFanout([0, 1, 2, 3]) as never);

    const result = await generateMealPlan.execute(
      { days: 2, mealsPerDay: ["breakfast", "dinner"] },
      makeCtx({ userId: USER_ID }),
      vi.fn()
    );

    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.data.mealPlanId).toBe(PLAN_ID);
    expect(result.data.failedSlots).toBe(0);

    expect(prisma.mealPlanTemplate.create).toHaveBeenCalledTimes(1);
    const meals = persistedMeals();
    expect(meals).toHaveLength(4);
    const libraryIds = new Set<string>(candidates.map((c) => c.id));
    for (const meal of meals) {
      expect(meal.generationFailed).toBe(false);
      expect(meal.recipeId).not.toBeNull();
      expect(libraryIds.has(meal.recipeId!)).toBe(true);
    }
  });

  it("marks a slot as failed when the model picks an index outside the library instead of persisting a fake id", async () => {
    const candidates = makeCandidates(4);
    seedDatabase(candidates);
    vi.mocked(getSkeletonModel).mockReturnValue(makeSkeleton("One Bad Pick") as never);
    // 4 slots: the second answer is out of range.
    vi.mocked(getFanoutModel).mockReturnValue(makeIndexFanout([0, 99, 1, 2]) as never);

    const result = await generateMealPlan.execute(
      { days: 2, mealsPerDay: ["breakfast", "dinner"] },
      makeCtx({ userId: USER_ID }),
      vi.fn()
    );

    // 1/4 = 25% — at the abort threshold, so the plan is NOT persisted. That is
    // the existing PlanIncompleteError contract; what matters here is that the
    // bad pick never reached the database as a recipe id.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/1\/4 slots failed/);
    expect(prisma.mealPlanTemplate.create).not.toHaveBeenCalled();
  });

  it("fails fast without calling any model when the library is empty", async () => {
    seedDatabase([]);
    vi.mocked(getSkeletonModel).mockReturnValue(makeSkeleton("Never Used") as never);
    vi.mocked(getFanoutModel).mockReturnValue(makeIndexFanout([0]) as never);

    const result = await generateMealPlan.execute(
      { days: 2, mealsPerDay: ["breakfast", "dinner"] },
      makeCtx({ userId: USER_ID }),
      vi.fn()
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(/no saved recipes/i);
    expect(getSkeletonModel).not.toHaveBeenCalled();
    expect(getFanoutModel).not.toHaveBeenCalled();
    expect(prisma.mealPlanTemplate.create).not.toHaveBeenCalled();
  });

  it("uses the profile's daily targets when the request carries none", async () => {
    const candidates = makeCandidates(4);
    seedDatabase(candidates);
    vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
      dailyCalories: 2100,
      proteinGrams: 150,
      carbsGrams: 220,
      fatGrams: 70,
      dietaryType: ["vegetarian"],
      allergies: ["peanut"],
    } as never);
    vi.mocked(getSkeletonModel).mockReturnValue(makeSkeleton("Profile Plan") as never);
    vi.mocked(getFanoutModel).mockReturnValue(makeIndexFanout([0, 1, 2, 3]) as never);

    const result = await generateMealPlan.execute(
      { days: 2, mealsPerDay: ["breakfast", "dinner"] },
      makeCtx({ userId: USER_ID }),
      vi.fn()
    );

    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    const args = vi.mocked(prisma.mealPlanTemplate.create).mock
      .calls[0]?.[0] as unknown as CreateArgs;
    expect(args.data.targetCalories).toBe(2100);
    expect(args.data.targetProtein).toBe(150);
    expect(args.data.targetCarbs).toBe(220);
    expect(args.data.targetFat).toBe(70);
  });
});
