/**
 * TDD: meal-plan CRUD tools — tests written BEFORE implementation.
 * Uses static imports + mock-as-MockedFunction pattern (compatible with Bun/vitest).
 * Run `bun test tests/unit/chat/meal-plan-tools.test.ts` to see red first.
 */
import { describe, it, expect, vi, type MockedFunction } from "vitest";
import { makeCtx } from "./_fixtures";

// ---------------------------------------------------------------------------
// Mock the server-action layer. vi.mock is hoisted before imports.
// ---------------------------------------------------------------------------
vi.mock("@/actions/meal-plan", () => ({
  getMealPlans: vi.fn(),
  getMealPlan: vi.fn(),
  addMealToDay: vi.fn(),
  moveMeal: vi.fn(),
  updateMealServings: vi.fn(),
  removeMealFromDay: vi.fn(),
}));

// Static imports — resolved AFTER mocks are hoisted
import * as mealPlanActions from "@/actions/meal-plan";
import { searchMealPlans } from "@/lib/chat/tools/searchMealPlans";
import { getMealPlan } from "@/lib/chat/tools/getMealPlan";
import { addMealToDay } from "@/lib/chat/tools/addMealToDay";
import { moveMeal } from "@/lib/chat/tools/moveMeal";
import { updateMealServings } from "@/lib/chat/tools/updateMealServings";
import { removeMealFromDay } from "@/lib/chat/tools/removeMealFromDay";

// Helper to access mocks — works around Bun's missing vi.mocked()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFn = <T extends (...args: any[]) => any>(fn: T) =>
  fn as unknown as MockedFunction<T>;

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------
const PLAN_ID = "00000000-0000-0000-0000-000000000001";
const DAY_ID = "00000000-0000-0000-0000-000000000002";
const MEAL_ID = "00000000-0000-0000-0000-000000000003";
const RECIPE_ID = "00000000-0000-0000-0000-000000000004";

const fakePlan = {
  id: PLAN_ID,
  name: "Weekly Wellness",
  duration: 7,
  targetCalories: 2000,
  targetProtein: 120,
  targetCarbs: 250,
  targetFat: 65,
  userId: "u1",
  createdAt: new Date(),
  days: [
    {
      id: DAY_ID,
      dayNumber: 1,
      templateId: PLAN_ID,
      meals: [
        {
          id: MEAL_ID,
          mealType: "breakfast",
          servings: 2,
          recipeId: RECIPE_ID,
          sortOrder: 0,
          mealPlanDayId: DAY_ID,
          generationFailed: false,
          generationError: null,
          recipe: { id: RECIPE_ID, title: "Oatmeal Bowl" },
        },
      ],
    },
  ],
};

const fakeMeal = {
  id: MEAL_ID,
  mealType: "breakfast",
  servings: 2,
  recipeId: RECIPE_ID,
  sortOrder: 0,
  mealPlanDayId: DAY_ID,
  recipe: { id: RECIPE_ID, title: "Oatmeal Bowl" },
  mealPlanDay: {
    templateId: PLAN_ID,
    template: { name: "Weekly Wellness" },
  },
};

// ===========================================================================
// searchMealPlans
// ===========================================================================
describe("searchMealPlans tool", () => {
  it("happy path — returns plans array", async () => {
    mockFn(mealPlanActions.getMealPlans).mockResolvedValueOnce({
      data: {
        templates: [fakePlan],
        pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
      },
      error: null,
    } as never);

    const result = await searchMealPlans.execute(
      { query: "wellness", limit: 8 },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.plans).toHaveLength(1);
      expect(result.data.plans[0].id).toBe(PLAN_ID);
      expect(result.data.plans[0].name).toBe("Weekly Wellness");
      expect(result.data.plans[0].duration).toBe(7);
    }
  });

  it("returns link for first plan when results exist", async () => {
    mockFn(mealPlanActions.getMealPlans).mockResolvedValueOnce({
      data: {
        templates: [fakePlan],
        pagination: { page: 1, limit: 8, total: 1, totalPages: 1 },
      },
      error: null,
    } as never);

    const result = await searchMealPlans.execute({ limit: 8 }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link).toEqual({
        type: "mealplan",
        href: `/meal-plans?selected=${PLAN_ID}`,
        label: "Weekly Wellness",
      });
    }
  });

  it("error path — action returns error", async () => {
    mockFn(mealPlanActions.getMealPlans).mockResolvedValueOnce({
      data: null,
      error: "DB unavailable",
    } as never);

    const result = await searchMealPlans.execute({ limit: 8 }, makeCtx());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
      expect(result.message).toBeTruthy();
    }
  });

  it("has requiresFeature: aiChat", () => {
    expect(searchMealPlans.requiresFeature).toBe("aiChat");
  });

  it("has statusKey mealplan.searching", () => {
    expect(searchMealPlans.statusKey).toBe("mealplan.searching");
  });
});

// ===========================================================================
// getMealPlan
// ===========================================================================
describe("getMealPlan tool", () => {
  it("happy path — returns structured plan with days and meals", async () => {
    mockFn(mealPlanActions.getMealPlan).mockResolvedValueOnce({
      data: fakePlan as never,
      error: null,
    });

    const result = await getMealPlan.execute({ id: PLAN_ID }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.id).toBe(PLAN_ID);
      expect(result.data.name).toBe("Weekly Wellness");
      expect(result.data.days).toHaveLength(1);
      expect(result.data.days[0].dayNumber).toBe(1);
      expect(result.data.days[0].meals).toHaveLength(1);
      expect(result.data.days[0].meals[0].mealType).toBe("breakfast");
    }
  });

  it("exposes each day's id so addMealToDay can target a slot", async () => {
    mockFn(mealPlanActions.getMealPlan).mockResolvedValueOnce({
      data: fakePlan as never,
      error: null,
    });

    const result = await getMealPlan.execute({ id: PLAN_ID }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.days[0].id).toBe(DAY_ID);
    }
  });

  it("always returns a mealplan link", async () => {
    mockFn(mealPlanActions.getMealPlan).mockResolvedValueOnce({
      data: fakePlan as never,
      error: null,
    });

    const result = await getMealPlan.execute({ id: PLAN_ID }, makeCtx());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link).toEqual({
        type: "mealplan",
        href: `/meal-plans?selected=${PLAN_ID}`,
        label: "Weekly Wellness",
      });
    }
  });

  it("error path — action returns not found", async () => {
    mockFn(mealPlanActions.getMealPlan).mockResolvedValueOnce({
      data: null,
      error: "Meal plan template not found",
    });

    const result = await getMealPlan.execute({ id: PLAN_ID }, makeCtx());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
    }
  });

  it("has requiresFeature: aiChat and correct statusKey", () => {
    expect(getMealPlan.requiresFeature).toBe("aiChat");
    expect(getMealPlan.statusKey).toBe("mealplan.loading");
  });
});

// ===========================================================================
// addMealToDay
// ===========================================================================
describe("addMealToDay tool", () => {
  it("happy path — returns meal data", async () => {
    mockFn(mealPlanActions.addMealToDay).mockResolvedValueOnce({
      data: fakeMeal as never,
      error: null,
    });

    const result = await addMealToDay.execute(
      {
        mealPlanDayId: DAY_ID,
        recipeId: RECIPE_ID,
        mealType: "breakfast",
        servings: 2,
      },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mealId).toBe(MEAL_ID);
      expect(result.data.recipeId).toBe(RECIPE_ID);
      expect(result.data.recipeName).toBe("Oatmeal Bowl");
      expect(result.data.mealType).toBe("breakfast");
      expect(result.data.servings).toBe(2);
    }
  });

  it("returns a mealplan link card to the parent plan", async () => {
    mockFn(mealPlanActions.addMealToDay).mockResolvedValueOnce({
      data: fakeMeal as never,
      error: null,
    });

    const result = await addMealToDay.execute(
      {
        mealPlanDayId: DAY_ID,
        recipeId: RECIPE_ID,
        mealType: "breakfast",
        servings: 2,
      },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.link).toEqual({
        type: "mealplan",
        href: `/meal-plans?selected=${PLAN_ID}`,
        label: "Weekly Wellness",
      });
    }
  });

  it("error path — action returns error", async () => {
    mockFn(mealPlanActions.addMealToDay).mockResolvedValueOnce({
      data: null,
      error: "Meal plan day not found",
    } as never);

    const result = await addMealToDay.execute(
      {
        mealPlanDayId: DAY_ID,
        recipeId: RECIPE_ID,
        mealType: "breakfast",
        servings: 1,
      },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
      expect(result.message).toContain("Meal plan day not found");
    }
  });

  it("has requiresFeature: aiChat and correct statusKey", () => {
    expect(addMealToDay.requiresFeature).toBe("aiChat");
    expect(addMealToDay.statusKey).toBe("mealplan.addingMeal");
  });
});

// ===========================================================================
// moveMeal
// ===========================================================================
describe("moveMeal tool", () => {
  const TARGET_DAY_ID = "00000000-0000-0000-0000-000000000005";

  it("happy path — returns moved meal data", async () => {
    mockFn(mealPlanActions.moveMeal).mockResolvedValueOnce({
      data: {
        ...fakeMeal,
        mealType: "lunch",
        mealPlanDayId: TARGET_DAY_ID,
      } as never,
      error: null,
    });

    const result = await moveMeal.execute(
      {
        mealId: MEAL_ID,
        targetMealPlanDayId: TARGET_DAY_ID,
        targetMealType: "lunch",
      },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mealId).toBe(MEAL_ID);
      expect(result.data.mealType).toBe("lunch");
      expect(result.data.dayId).toBe(TARGET_DAY_ID);
    }
  });

  it("error path — action returns error", async () => {
    mockFn(mealPlanActions.moveMeal).mockResolvedValueOnce({
      data: null,
      error: "Meal not found",
    } as never);

    const result = await moveMeal.execute(
      {
        mealId: MEAL_ID,
        targetMealPlanDayId: TARGET_DAY_ID,
        targetMealType: "lunch",
      },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
    }
  });

  it("has requiresFeature: aiChat and correct statusKey", () => {
    expect(moveMeal.requiresFeature).toBe("aiChat");
    expect(moveMeal.statusKey).toBe("mealplan.movingMeal");
  });
});

// ===========================================================================
// updateMealServings
// ===========================================================================
describe("updateMealServings tool", () => {
  it("happy path — returns updated meal", async () => {
    mockFn(mealPlanActions.updateMealServings).mockResolvedValueOnce({
      data: { ...fakeMeal, servings: 4 } as never,
      error: null,
    });

    const result = await updateMealServings.execute(
      { mealId: MEAL_ID, servings: 4 },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mealId).toBe(MEAL_ID);
      expect(result.data.servings).toBe(4);
    }
  });

  it("error path — action returns error", async () => {
    mockFn(mealPlanActions.updateMealServings).mockResolvedValueOnce({
      data: null,
      error: "Meal not found",
    } as never);

    const result = await updateMealServings.execute(
      { mealId: MEAL_ID, servings: 4 },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
    }
  });

  it("has requiresFeature: aiChat and correct statusKey", () => {
    expect(updateMealServings.requiresFeature).toBe("aiChat");
    expect(updateMealServings.statusKey).toBe("mealplan.updatingServings");
  });
});

// ===========================================================================
// removeMealFromDay — DESTRUCTIVE, requires confirmation
// ===========================================================================
describe("removeMealFromDay tool", () => {
  it("requiresConfirmation returns a descriptor for all inputs", async () => {
    const descriptor = await removeMealFromDay.requiresConfirmation!(
      { mealId: MEAL_ID },
      makeCtx()
    );
    expect(descriptor).not.toBeNull();
    expect(descriptor?.message).toBeTruthy();
    expect(descriptor?.payload).toMatchObject({ mealId: MEAL_ID, confirmed: true });
  });

  it("happy path — confirmed: true removes the meal", async () => {
    mockFn(mealPlanActions.removeMealFromDay).mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });

    const result = await removeMealFromDay.execute(
      { mealId: MEAL_ID, confirmed: true },
      makeCtx()
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mealId).toBe(MEAL_ID);
    }
  });

  it("returns generic error if execute called without confirmed", async () => {
    const result = await removeMealFromDay.execute(
      { mealId: MEAL_ID },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
    }
  });

  it("error path — action returns error", async () => {
    mockFn(mealPlanActions.removeMealFromDay).mockResolvedValueOnce({
      data: null,
      error: "Meal not found",
    });

    const result = await removeMealFromDay.execute(
      { mealId: MEAL_ID, confirmed: true },
      makeCtx()
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("generic");
    }
  });

  it("has requiresFeature: aiChat and correct statusKey", () => {
    expect(removeMealFromDay.requiresFeature).toBe("aiChat");
    expect(removeMealFromDay.statusKey).toBe("mealplan.removingMeal");
  });
});
