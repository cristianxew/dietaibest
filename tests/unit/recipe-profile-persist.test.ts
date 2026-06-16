import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    recipe: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { saveRecipeNutritionProfile } from "@/actions/recipe";

const baseUser = { id: "user-1", email: "u@dietai.test" };

const PROFILE = {
  calories: 250,
  protein: 10,
  carbs: 30,
  fat: 8,
  fiber: 4,
  sugar: 5,
  sodium: 100,
  cholesterol: 20,
  saturatedFat: 2.4,
  transFat: 0,
  vitaminA: 1,
  vitaminC: 2,
  vitaminD: 3,
  vitaminE: 4,
  vitaminK: 5,
  vitaminB12: 6,
  folate: 7,
  iron: 8,
  calcium: 9,
  magnesium: 10,
  potassium: 11,
  zinc: 1.2,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: baseUser.email },
  } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue(baseUser as never);
});

describe("saveRecipeNutritionProfile", () => {
  it("writes the full 22-nutrient profile for the recipe owner", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      userId: baseUser.id,
    } as never);
    vi.mocked(prisma.recipe.update).mockResolvedValue({ id: "r1" } as never);

    const res = await saveRecipeNutritionProfile("r1", PROFILE);

    expect(res.error).toBeNull();
    const args = vi.mocked(prisma.recipe.update).mock.calls.at(-1)![0] as {
      where: { id: string };
      data: Record<string, number>;
    };
    expect(args.where.id).toBe("r1");
    // macros + micros all persisted
    expect(args.data.calories).toBe(250);
    expect(args.data.fiber).toBe(4);
    expect(args.data.calcium).toBe(9);
    expect(args.data.vitaminD).toBe(3);
    expect(args.data.zinc).toBe(1.2);
    expect(revalidatePath).toHaveBeenCalledWith("/recipes/r1");
  });

  it("refuses to write to a recipe the user does not own", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      userId: "someone-else",
    } as never);

    const res = await saveRecipeNutritionProfile("r1", PROFILE);

    expect(res.error).toBe("Unauthorized");
    expect(prisma.recipe.update).not.toHaveBeenCalled();
  });

  it("returns an error when the recipe does not exist", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue(null as never);

    const res = await saveRecipeNutritionProfile("missing", PROFILE);

    expect(res.error).toBe("Recipe not found");
    expect(prisma.recipe.update).not.toHaveBeenCalled();
  });
});
