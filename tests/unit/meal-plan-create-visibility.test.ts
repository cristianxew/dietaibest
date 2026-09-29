/**
 * createMealPlan — explicit `days[].meals[].recipeId` values must reference
 * recipes the caller may use (own, or public). Before this guard the AI
 * generator — or any direct caller — could link another user's private recipe
 * into a plan. Also locks the original generator symptom: a non-UUID id is
 * rejected at validation, before any database write.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => {
  const prisma = {
    user: { findUnique: vi.fn() },
    recipe: { count: vi.fn(), findMany: vi.fn() },
    mealPlanTemplate: { count: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  };
  return { prisma, default: prisma };
});

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { createMealPlan } from "@/actions/meal-plan";

const USER_ID = randomUUID();
const OWN_RECIPE = randomUUID();
const PUBLIC_FOREIGN_RECIPE = randomUUID();
const PRIVATE_FOREIGN_RECIPE = randomUUID();

function planWith(recipeIds: Array<string | null>) {
  return {
    name: "Visibility plan",
    duration: 1,
    mealSlots: ["breakfast", "dinner"],
    isPublic: false,
    days: [
      {
        dayNumber: 1,
        meals: recipeIds.map((recipeId, i) => ({
          recipeId,
          mealType: i === 0 ? "breakfast" : "dinner",
          servings: 1,
        })),
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "owner@test.local" },
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    id: USER_ID,
    email: "owner@test.local",
    plan: "pro",
    subscriptionStatus: "active",
  } as never);
  vi.mocked(prisma.recipe.count).mockResolvedValue(0);
  vi.mocked(prisma.mealPlanTemplate.count).mockResolvedValue(0);
  vi.mocked(prisma.mealPlanTemplate.create).mockResolvedValue({
    id: "plan-1",
    name: "Visibility plan",
    days: [],
  } as never);
  // Visibility query double: only own + public recipes are "found".
  vi.mocked(prisma.recipe.findMany).mockImplementation((async (args: {
    where?: { id?: { in?: string[] } };
  }) => {
    const accessible = new Set<string>([OWN_RECIPE, PUBLIC_FOREIGN_RECIPE]);
    return (args?.where?.id?.in ?? [])
      .filter((id) => accessible.has(id))
      .map((id) => ({ id }));
  }) as never);
});

describe("createMealPlan recipe visibility", () => {
  it("accepts own and public recipes", async () => {
    const result = await createMealPlan(
      planWith([OWN_RECIPE, PUBLIC_FOREIGN_RECIPE]) as never
    );
    expect(result.error).toBeNull();
    expect(prisma.mealPlanTemplate.create).toHaveBeenCalledTimes(1);
  });

  it("accepts failed (null) slots without running the visibility query", async () => {
    const result = await createMealPlan(planWith([null, null]) as never);
    expect(result.error).toBeNull();
    expect(prisma.recipe.findMany).not.toHaveBeenCalled();
    expect(prisma.mealPlanTemplate.create).toHaveBeenCalledTimes(1);
  });

  it("rejects a private recipe owned by another user", async () => {
    const result = await createMealPlan(
      planWith([OWN_RECIPE, PRIVATE_FOREIGN_RECIPE]) as never
    );
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/not accessible/i);
    expect(prisma.mealPlanTemplate.create).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID recipe id at validation, before any write", async () => {
    const result = await createMealPlan(planWith(["recipe-123", OWN_RECIPE]) as never);
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/Invalid input: Invalid uuid/);
    expect(prisma.recipe.findMany).not.toHaveBeenCalled();
    expect(prisma.mealPlanTemplate.create).not.toHaveBeenCalled();
  });
});
