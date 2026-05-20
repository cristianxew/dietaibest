import type { Prisma } from "@/generated/prisma";
import type {
  MealPlanTemplateDisplay,
  DayDisplay,
  MealDisplay,
  MealType,
  MacroSummary,
} from "@/types/meal-plan";
import { calculateMealMacros, sumMacros } from "@/lib/meal-plan-macros";

export type TemplateWithMealsAndSchedules = Prisma.MealPlanTemplateGetPayload<{
  include: {
    days: { include: { meals: { include: { recipe: true } } } };
    schedules: true;
  };
}>;

function emptyMacros(): MacroSummary {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export function toTemplateDisplay(
  template: TemplateWithMealsAndSchedules,
  unknownRecipeLabel = ""
): MealPlanTemplateDisplay {
  const days: DayDisplay[] = template.days.map((day) => {
    const meals: MealDisplay[] = (day.meals ?? []).map((meal) => {
      const r = meal.recipe;
      const macros = r
        ? calculateMealMacros(r.calories ?? 0, r.protein ?? 0, r.carbs ?? 0, r.fat ?? 0, 1, meal.servings)
        : emptyMacros();
      return {
        id: meal.id,
        recipeId: meal.recipeId,
        recipeName: r?.title ?? unknownRecipeLabel,
        recipeImage: r?.imageUrl ?? undefined,
        mealType: meal.mealType as unknown as MealType,
        servings: meal.servings,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
      };
    });
    return { id: day.id, dayNumber: day.dayNumber, date: undefined, meals, macros: sumMacros(meals) };
  });

  // Round to 1 decimal to stay consistent with calculateWeeklyMacros in meal-plan-macros.ts
  const avg = (pick: (d: DayDisplay) => number) =>
    Math.round((days.reduce((s, d) => s + pick(d), 0) / days.length) * 10) / 10;
  const averageMacros: MacroSummary = days.length
    ? {
        calories: avg((d) => d.macros.calories),
        protein: avg((d) => d.macros.protein),
        carbs: avg((d) => d.macros.carbs),
        fat: avg((d) => d.macros.fat),
      }
    : emptyMacros();

  return {
    id: template.id,
    name: template.name,
    duration: template.duration,
    mealSlots: template.mealSlots as unknown as MealType[],
    isPublic: template.isPublic,
    shareToken: template.shareToken ?? undefined,
    targets: {
      calories: template.targetCalories ?? undefined,
      protein: template.targetProtein ?? undefined,
      carbs: template.targetCarbs ?? undefined,
      fat: template.targetFat ?? undefined,
    },
    days,
    averageMacros,
  };
}
