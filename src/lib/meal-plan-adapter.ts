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

  const averageMacros: MacroSummary = days.length
    ? {
        calories: Math.round(days.reduce((s, d) => s + d.macros.calories, 0) / days.length),
        protein: Math.round(days.reduce((s, d) => s + d.macros.protein, 0) / days.length),
        carbs: Math.round(days.reduce((s, d) => s + d.macros.carbs, 0) / days.length),
        fat: Math.round(days.reduce((s, d) => s + d.macros.fat, 0) / days.length),
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
