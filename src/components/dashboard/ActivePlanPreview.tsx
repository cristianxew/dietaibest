"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { recipeHref } from "@/lib/recipe-back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ArrowRight,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Coffee,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, format } from "date-fns";
import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";
import { MEAL_SLOT_META } from "@/lib/meal-slot-meta";
import type { MealType } from "@/types/meal-plan";

interface Meal {
  id: string;
  mealType: string;
  servings: number;
  recipe: {
    id: string;
    title: string;
    imageUrl?: string | null;
    calories?: number | null;
  } | null;
}

interface ActivePlanPreviewProps {
  templateId: string;
  templateName: string;
  startDate: Date;
  duration: number;
  currentDayNumber: number;
  daysRemaining: number;
  selectedDayNumber?: number;
  onSelectDay?: (day: number) => void;
  selectedMeals?: Meal[];
}

const getMealIcon = (mealType: string) => {
  switch (mealType.toLowerCase()) {
    case "breakfast":
      return Coffee;
    case "lunch":
      return Sun;
    case "dinner":
      return Sunset;
    case "snack":
      return Moon;
    default:
      return UtensilsCrossed;
  }
};

/** `mealPlans` translation key for a meal type, or null for an unknown type. */
const getMealLabelKey = (mealType: string) =>
  MEAL_SLOT_META[mealType as MealType]?.i18nKey ?? null;

// The row bleeds 8px past the content edge (-mx-2) so its hover background
// has even padding on both sides while the title lines up with the meal-type
// label (icon 14px + gap 8px) and the kcal stays on the card's content edge.
const mealRowClass =
  "-mx-2 flex items-center justify-between rounded-lg py-1.5 pl-7.5 pr-2 pointer-coarse:min-h-11";

export function ActivePlanPreview({
  templateId,
  templateName,
  duration,
  currentDayNumber,
  daysRemaining: _daysRemaining,
  selectedDayNumber,
  onSelectDay,
  selectedMeals = [],
}: ActivePlanPreviewProps) {
  const t = useTranslations("dashboard.activePlan");
  const tMeal = useTranslations("mealPlans");
  const locale = useLocale();

  const mealLabel = (mealType: string) => {
    const key = getMealLabelKey(mealType);
    return key ? tMeal(key) : mealType.charAt(0).toUpperCase() + mealType.slice(1);
  };

  // Generate mini calendar days (3 before today, today, 3 after)
  const today = new Date();
  const calendarDays = [];
  for (let i = -3; i <= 3; i++) {
    const date = addDays(today, i);
    const dayInPlan = currentDayNumber + i;
    const isWithinPlan = dayInPlan >= 1 && dayInPlan <= duration;
    calendarDays.push({
      date,
      dayNumber: dayInPlan,
      isToday: dayInPlan === currentDayNumber,
      isSelected: dayInPlan === (selectedDayNumber || currentDayNumber),
      isWithinPlan,
      dayName: format(date, "EEE").slice(0, 2),
      dayOfMonth: format(date, "d"),
      fullDate: date.toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
      }),
    });
  }

  // Group meals by type
  const mealsByType = selectedMeals.reduce((acc, meal) => {
    if (!acc[meal.mealType]) {
      acc[meal.mealType] = [];
    }
    acc[meal.mealType].push(meal);
    return acc;
  }, {} as Record<string, Meal[]>);

  const mealOrder = ["breakfast", "lunch", "dinner", "snack"];
  const sortedMealTypes = Object.keys(mealsByType).sort(
    (a, b) => mealOrder.indexOf(a) - mealOrder.indexOf(b)
  );

  return (
    <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm overflow-hidden">

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("eyebrow")}
            </p>
            <CardTitle className="text-lg font-display font-semibold tracking-tight truncate">
              {templateName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("day", { current: selectedDayNumber ?? currentDayNumber, total: duration })}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs gap-1">
            <Link href="/meal-plans">
              {t("viewAllPlans")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Mini Calendar. Each day is one button spanning its column, so the
            hit area is as wide as the row allows and ≥ 44px tall. */}
        <div className="flex justify-between items-stretch gap-0.5">
          {calendarDays.map((day) => (
            <button
              key={day.dayNumber}
              type="button"
              disabled={!day.isWithinPlan}
              aria-pressed={day.isWithinPlan ? day.isSelected : undefined}
              aria-label={
                day.isWithinPlan
                  ? t("calendarDay", { date: day.fullDate, day: day.dayNumber, total: duration })
                  : t("calendarDayOutside", { date: day.fullDate })
              }
              onClick={() => onSelectDay?.(day.dayNumber)}
              className={cn(
                "group/day flex flex-1 min-w-0 flex-col items-center gap-1 rounded-xl py-1 outline-none transition-all duration-200 pointer-coarse:min-h-11",
                "focus-visible:ring-2 focus-visible:ring-ring",
                day.isWithinPlan ? "cursor-pointer" : "cursor-default",
                day.isToday && "scale-105"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "text-[11px] uppercase tracking-wide",
                  day.isSelected
                    ? "text-brand-700 dark:text-brand-600 font-semibold"
                    : "text-muted-foreground"
                )}
              >
                {day.dayName}
              </span>
              <span
                aria-hidden
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium tabular-nums transition-all",
                  day.isSelected
                    ? "bg-primary text-primary-foreground shadow-lg shadow-brand-500/30"
                    : day.isWithinPlan
                      ? "bg-stone-100 dark:bg-stone-800 text-foreground group-hover/day:opacity-80"
                      : "text-muted-foreground/50"
                )}
              >
                {day.dayOfMonth}
              </span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/60 dark:bg-stone-800/60" />

        {/* Today's Meals */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            {selectedDayNumber === undefined || selectedDayNumber === currentDayNumber
              ? t("todaysMeals")
              : t("dayMeals", { day: selectedDayNumber })}
          </h4>

          {selectedMeals.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              {t("noMealsToday")}
            </p>
          ) : (
            <div className="space-y-2">
              {sortedMealTypes.map((mealType) => {
                const meals = mealsByType[mealType];
                const Icon = getMealIcon(mealType);

                return (
                  <div key={mealType} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {mealLabel(mealType)}
                      </span>
                    </div>
                    {meals.map((meal) => {
                      const content = (
                        <>
                          <span className="text-sm text-foreground truncate flex-1">
                            {meal.recipe?.title || t("noRecipe")}
                          </span>
                          {/* Recipe calories are per serving: scale by the
                              meal's servings, like the totals above. */}
                          {meal.recipe?.calories ? (
                            <span className="text-xs text-muted-foreground tabular-nums ml-2">
                              {Math.round(meal.recipe.calories * meal.servings)} {t("kcalUnit")}
                            </span>
                          ) : null}
                        </>
                      );

                      return meal.recipe ? (
                        <Link
                          key={meal.id}
                          href={recipeHref(locale, meal.recipe.id, "/dashboard")}
                          className={cn(
                            mealRowClass,
                            "outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                          )}
                        >
                          {content}
                        </Link>
                      ) : (
                        <div key={meal.id} className={mealRowClass}>
                          {content}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* View Plan Button */}
        <Button asChild variant="outline" size="sm">
          <Link
            href={`/meal-plans?selected=${encodeURIComponent(templateId)}`}
            className="gap-2"
          >
            {t("viewPlan")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// Empty state component
export function ActivePlanEmpty() {
  const t = useTranslations("dashboard.activePlan");

  return (
    <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display font-semibold tracking-tight">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-center py-8 space-y-4">
          <EmptyStateIcon icon={Calendar} size="sm" />
          <div className="space-y-2">
            <p className="font-medium text-foreground">{t("noActivePlan")}</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {t("noActivePlanDescription")}
            </p>
          </div>
          <Link
            href="/meal-plans"
            className="inline-flex items-center gap-0.5 text-sm font-medium text-brand-600 hover:underline underline-offset-4"
          >
            {t("schedulePlan")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
