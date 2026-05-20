import { describe, it, expect } from "vitest";
import { toTemplateDisplay } from "@/lib/meal-plan-adapter";

const fakeTemplate = {
  id: "tpl-1",
  name: "Test Plan",
  duration: 2,
  mealSlots: ["breakfast", "lunch", "dinner"],
  isPublic: false,
  shareToken: null,
  targetCalories: 2000,
  targetProtein: 150,
  targetCarbs: 200,
  targetFat: 60,
  days: [
    {
      id: "day-1",
      dayNumber: 1,
      meals: [
        {
          id: "meal-1",
          recipeId: "rec-1",
          mealType: "breakfast",
          servings: 2,
          recipe: { title: "Oats", imageUrl: null, calories: 300, protein: 10, carbs: 50, fat: 5 },
        },
      ],
    },
  ],
};

describe("toTemplateDisplay", () => {
  it("maps a Prisma template into a display template with calculated macros", () => {
    const result = toTemplateDisplay(fakeTemplate as never);
    expect(result.id).toBe("tpl-1");
    expect(result.mealSlots).toEqual(["breakfast", "lunch", "dinner"]);
    expect(result.targets).toEqual({ calories: 2000, protein: 150, carbs: 200, fat: 60 });
    expect(result.days[0].meals[0].calories).toBe(600); // 300 * 2 servings
    expect(result.days[0].macros.calories).toBe(600);
    expect(result.averageMacros.calories).toBe(600);
  });

  it("handles a meal whose recipe is missing", () => {
    const t = { ...fakeTemplate, days: [{ id: "d", dayNumber: 1, meals: [
      { id: "m", recipeId: null, mealType: "lunch", servings: 1, recipe: null },
    ] }] };
    const result = toTemplateDisplay(t as never);
    expect(result.days[0].meals[0].recipeName).toBe("");
    expect(result.days[0].meals[0].calories).toBe(0);
  });
});
