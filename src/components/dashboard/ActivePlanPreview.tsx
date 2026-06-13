"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
  Coffee,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, format } from "date-fns";
import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";

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

const getMealLabel = (mealType: string) => {
  return mealType.charAt(0).toUpperCase() + mealType.slice(1);
};

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
            <CardTitle className="text-lg font-display font-semibold tracking-tight truncate">
              {templateName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("day", { current: currentDayNumber, total: duration })}
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
        {/* Mini Calendar */}
        <div className="flex justify-between items-center gap-1">
          {calendarDays.map((day, index) => (
            <div
              key={index}
              className={cn(
                "flex flex-col items-center gap-1 transition-all duration-200",
                day.isToday && "scale-105"
              )}
            >
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wide",
                  day.isSelected
                    ? "text-brand-600 dark:text-brand-400 font-semibold"
                    : "text-muted-foreground"
                )}
              >
                {day.dayName}
              </span>
              <div
                onClick={() => {
                  if (day.isWithinPlan) {
                    onSelectDay?.(day.dayNumber);
                  }
                }}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                  day.isSelected
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30 cursor-pointer"
                    : day.isWithinPlan
                      ? "bg-stone-100 dark:bg-stone-800 text-foreground hover:opacity-80 cursor-pointer"
                      : "text-muted-foreground/50"
                )}
              >
                {day.dayOfMonth}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-stone-200/60 dark:bg-stone-800/60" />

        {/* Today's Meals */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            {selectedDayNumber === currentDayNumber ? t("todaysMeals") : `Day ${selectedDayNumber} Meals`}
          </h4>

          {selectedMeals.length === 0 ? (
            <p className="text-sm text-muted-foreground/70 italic">
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
                        {getMealLabel(mealType)}
                      </span>
                    </div>
                    {meals.map((meal) => (
                      <div
                        key={meal.id}
                        className="flex items-center justify-between pl-5 py-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                      >
                        <span className="text-sm text-foreground truncate flex-1">
                          {meal.recipe?.title || t("noRecipe")}
                        </span>
                        {meal.recipe?.calories && (
                          <span className="text-xs text-muted-foreground font-mono ml-2">
                            {meal.recipe.calories} {t("kcalUnit")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* View Plan Button */}
        <Button asChild variant="outline" size="sm">
          <Link href="/meal-plans" className="gap-2">
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
          <Button asChild size="default" className="shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            <Link href="/meal-plans" className="gap-2">
              {t("schedulePlan")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
