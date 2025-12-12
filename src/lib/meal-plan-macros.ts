import type {
  MacroSummary,
  MacroTarget,
  MacroComparison,
  MacroComparisons,
  DayMacros,
  WeeklyMacros,
  MealDisplay,
  DayDisplay,
} from "@/types/meal-plan";

/**
 * Calculate macros for a single meal based on recipe data and servings
 *
 * NOTE: Recipe nutritional values (calories, protein, carbs, fat) are stored
 * as PER-SERVING values in the database. Therefore, we only need to multiply
 * by the number of servings in this meal, NOT divide by recipe servings.
 */
export function calculateMealMacros(
  recipeCalories: number,
  recipeProtein: number,
  recipeCarbs: number,
  recipeFat: number,
  recipeServings: number, // Not used - kept for backward compatibility
  mealServings: number
): MacroSummary {
  // Recipe values are already per-serving, so just multiply by meal servings
  return {
    calories: Math.round(recipeCalories * mealServings * 10) / 10,
    protein: Math.round(recipeProtein * mealServings * 10) / 10,
    carbs: Math.round(recipeCarbs * mealServings * 10) / 10,
    fat: Math.round(recipeFat * mealServings * 10) / 10,
  };
}

/**
 * Sum macros from multiple meals
 */
export function sumMacros(meals: MacroSummary[]): MacroSummary {
  const total = meals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fat: acc.fat + meal.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  return {
    calories: Math.round(total.calories * 10) / 10,
    protein: Math.round(total.protein * 10) / 10,
    carbs: Math.round(total.carbs * 10) / 10,
    fat: Math.round(total.fat * 10) / 10,
  };
}

/**
 * Calculate daily macros from a day's meals
 */
export function calculateDayMacros(
  meals: MealDisplay[],
  dayNumber: number,
  date?: Date
): DayMacros {
  const macros = sumMacros(meals);
  return {
    ...macros,
    dayNumber,
    date,
  };
}

/**
 * Calculate weekly macros from all days
 */
export function calculateWeeklyMacros(days: DayDisplay[]): WeeklyMacros {
  const dayMacros: DayMacros[] = days.map((day) => ({
    dayNumber: day.dayNumber,
    date: day.date,
    ...day.macros,
  }));

  const totalMacros = sumMacros(dayMacros);

  const numDays = days.length || 1; // Prevent division by zero
  const averageDailyMacros: MacroSummary = {
    calories: Math.round((totalMacros.calories / numDays) * 10) / 10,
    protein: Math.round((totalMacros.protein / numDays) * 10) / 10,
    carbs: Math.round((totalMacros.carbs / numDays) * 10) / 10,
    fat: Math.round((totalMacros.fat / numDays) * 10) / 10,
  };

  return {
    totalMacros,
    averageDailyMacros,
    days: dayMacros,
  };
}

/**
 * Compare actual macros against target with status indicator
 */
export function compareMacro(
  actual: number,
  target?: number
): MacroComparison {
  if (!target || target === 0) {
    return {
      actual,
      target,
      percentage: undefined,
      status: "on-track",
    };
  }

  const percentage = Math.round((actual / target) * 100);

  // Determine status based on percentage thresholds
  let status: "under" | "on-track" | "over";
  if (percentage < 90) {
    status = "under";
  } else if (percentage <= 110) {
    status = "on-track";
  } else {
    status = "over";
  }

  return {
    actual,
    target,
    percentage,
    status,
  };
}

/**
 * Compare all macros against targets
 */
export function compareMacros(
  actual: MacroSummary,
  targets?: MacroTarget
): MacroComparisons {
  return {
    calories: compareMacro(actual.calories, targets?.calories),
    protein: compareMacro(actual.protein, targets?.protein),
    carbs: compareMacro(actual.carbs, targets?.carbs),
    fat: compareMacro(actual.fat, targets?.fat),
  };
}

/**
 * Get color class for macro status (for Tailwind CSS)
 * Uses the Culinary Elegance design system colors
 */
export function getMacroStatusColor(
  status: "under" | "on-track" | "over"
): string {
  switch (status) {
    case "under":
      return "text-gold-700 bg-gold-50 border-gold-200 dark:text-gold-400 dark:bg-gold-500/10 dark:border-gold-500/30";
    case "on-track":
      return "text-sage-700 bg-sage-50 border-sage-200 dark:text-sage-400 dark:bg-sage-500/10 dark:border-sage-500/30";
    case "over":
      return "text-brand-700 bg-brand-50 border-brand-200 dark:text-brand-400 dark:bg-brand-500/10 dark:border-brand-500/30";
  }
}

/**
 * Get progress bar color class for macro status
 * Uses the Culinary Elegance design system colors
 */
export function getMacroProgressColor(
  status: "under" | "on-track" | "over"
): string {
  switch (status) {
    case "under":
      return "bg-gold-500";
    case "on-track":
      return "bg-sage-500";
    case "over":
      return "bg-brand-500";
  }
}

/**
 * Get status label for display
 */
export function getMacroStatusLabel(
  status: "under" | "on-track" | "over"
): string {
  switch (status) {
    case "under":
      return "Under Target";
    case "on-track":
      return "On Track";
    case "over":
      return "Over Target";
  }
}

/**
 * Format macro value for display with appropriate units
 */
export function formatMacroValue(value: number, type: "calories" | "macros"): string {
  const rounded = Math.round(value * 10) / 10;
  return type === "calories" ? `${rounded} cal` : `${rounded}g`;
}

/**
 * Calculate percentage for progress bar (capped at 100%)
 */
export function getProgressPercentage(actual: number, target?: number): number {
  if (!target || target === 0) return 0;
  const percentage = (actual / target) * 100;
  return Math.min(percentage, 100); // Cap at 100% for display
}
