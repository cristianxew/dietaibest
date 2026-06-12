import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    mealPlanTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// Partial mock: keep error classes (toEntitlementError does instanceof checks)
vi.mock("@/lib/entitlements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/entitlements")>();
  return { ...actual, assertCanCreateMealPlanTemplate: vi.fn() };
});

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  getPublicMealPlans,
  getMealPlanByShareToken,
} from "@/actions/meal-plan";

const viewer = { id: "user-1", email: "viewer@dietai.test" };

const publicTemplate = {
  id: "tpl-1",
  name: "Cut Week",
  duration: 7,
  mealSlots: ["breakfast", "lunch", "dinner"],
  targetCalories: 2000,
  targetProtein: 150,
  targetCarbs: 200,
  targetFat: 60,
  createdAt: new Date(),
  user: { id: "user-2", email: "alice@example.com" },
  _count: { days: 7 },
};

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: viewer.email },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.user.findUnique).mockResolvedValue(viewer as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.mealPlanTemplate.findMany).mockResolvedValue([] as any);
  vi.mocked(prisma.mealPlanTemplate.count).mockResolvedValue(0);
});

describe("getPublicMealPlans", () => {
  it("filters to public templates from other users", async () => {
    await getPublicMealPlans();
    const args = vi.mocked(prisma.mealPlanTemplate.findMany).mock.calls.at(
      -1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )![0] as any;
    expect(args.where.isPublic).toBe(true);
    expect(args.where.userId).toEqual({ not: viewer.id });
  });

  it("returns a derived author name and never the raw email", async () => {
    vi.mocked(prisma.mealPlanTemplate.findMany).mockResolvedValue([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicTemplate as any,
    ]);
    vi.mocked(prisma.mealPlanTemplate.count).mockResolvedValue(1);

    const result = await getPublicMealPlans();

    expect(result.error).toBeNull();
    expect(result.data!.templates[0].user).toEqual({
      id: "user-2",
      name: "alice",
    });
    expect(JSON.stringify(result)).not.toContain("alice@example.com");
  });

  it("rejects invalid filters via zod (limit above max)", async () => {
    const result = await getPublicMealPlans({ page: 1, limit: 100 });
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(prisma.mealPlanTemplate.findMany).not.toHaveBeenCalled();
  });
});

describe("getMealPlanByShareToken", () => {
  it("returns an author display name instead of the owner's email", async () => {
    vi.mocked(prisma.mealPlanTemplate.findUnique).mockResolvedValue({
      ...publicTemplate,
      isPublic: true,
      shareToken: "tok",
      days: [],
      user: { email: "alice@example.com" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getMealPlanByShareToken("tok");

    expect(result.error).toBeNull();
    expect(result.data!.author).toBe("alice");
    expect(JSON.stringify(result)).not.toContain("alice@example.com");
  });

  it("only resolves public templates by token", async () => {
    vi.mocked(prisma.mealPlanTemplate.findUnique).mockResolvedValue(null);

    const result = await getMealPlanByShareToken("missing");

    const args = vi.mocked(prisma.mealPlanTemplate.findUnique).mock.calls.at(
      -1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    )![0] as any;
    expect(args.where).toEqual({ shareToken: "missing", isPublic: true });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Meal plan template not found or not public");
  });
});
