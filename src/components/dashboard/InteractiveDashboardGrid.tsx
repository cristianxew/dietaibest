"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CompactNutrition } from "./CompactNutrition";
import { WeeklyMacroChart } from "./WeeklyMacroChart";
import { ActivePlanPreview, ActivePlanEmpty } from "./ActivePlanPreview";
import { RecentRecipesCarousel } from "./RecentRecipesCarousel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { WeeklyMacroData } from "@/actions/dashboard";
import type { MacroTargets } from "@/lib/macro-breakdown";

interface InteractiveDashboardGridProps {
  todaysMacros: any;
  weeklyMacros: WeeklyMacroData[];
  activePlan: any;
  /** Resolved once in the data layer; every card measures against these. */
  targets: MacroTargets;
  recentRecipes: any;
  hasActivePlan: boolean;
}

/** `iso` (YYYY-MM-DD) moved by `days`, computed in UTC so no time zone shifts it. */
function shiftIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function InteractiveDashboardGrid({
  todaysMacros,
  weeklyMacros,
  activePlan,
  targets,
  recentRecipes,
  hasActivePlan,
}: InteractiveDashboardGridProps) {
  const t = useTranslations("dashboard.todaysMacros");
  const [selectedDayNumber, setSelectedDayNumber] = useState(
    activePlan?.currentDayNumber || 1
  );

  let selectedMeals = activePlan?.todaysMeals || [];
  let displayMacros = todaysMacros;

  if (activePlan && activePlan.template && activePlan.template.days) {
    const selectedDay = activePlan.template.days.find(
      (d: any) => d.dayNumber === selectedDayNumber
    );
    if (selectedDay) {
      selectedMeals = selectedDay.meals || [];

      let calories = 0,
        protein = 0,
        carbs = 0,
        fat = 0;
      selectedMeals.forEach((meal: any) => {
        if (meal.recipe) {
          calories += (meal.recipe.calories || 0) * meal.servings;
          protein += (meal.recipe.protein || 0) * meal.servings;
          carbs += (meal.recipe.carbs || 0) * meal.servings;
          fat += (meal.recipe.fat || 0) * meal.servings;
        }
      });

      displayMacros = {
        ...todaysMacros,
        calories: Math.round(calories),
        protein: Math.round(protein),
        carbs: Math.round(carbs),
        fat: Math.round(fat),
      };
    }
  }

  const isToday = !activePlan || selectedDayNumber === activePlan.currentDayNumber;
  const nutritionTitle = isToday
    ? t("plannedToday")
    : t("plannedForDay", { day: selectedDayNumber });

  // The weekly chart's "today" row (computed on the server) anchors the
  // selected plan day, so the client's time zone can't shift it.
  const todayRow = weeklyMacros.find((d) => d.isToday);
  const highlightDate =
    todayRow && activePlan
      ? shiftIsoDate(todayRow.date, selectedDayNumber - activePlan.currentDayNumber)
      : todayRow?.date;

  // DOM order is the phone order: plan, planned nutrition, weekly chart,
  // recent recipes. From lg the plan and the nutrition column sit side by side
  // at the top, and recipes fill the space under the plan.
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-start gap-6">
      {hasActivePlan && activePlan ? (
        <div className="relative group lg:col-span-7">
          <div className="absolute -inset-0.5 bg-gradient-to-br from-sage-300/30 to-brand-300/30 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
          <ActivePlanPreview
            templateId={activePlan.templateId}
            templateName={activePlan.templateName}
            startDate={activePlan.startDate}
            duration={activePlan.duration}
            currentDayNumber={activePlan.currentDayNumber}
            daysRemaining={activePlan.daysRemaining}
            selectedDayNumber={selectedDayNumber}
            onSelectDay={setSelectedDayNumber}
            selectedMeals={selectedMeals}
          />
        </div>
      ) : (
        <div className="lg:col-span-7">
          <ActivePlanEmpty />
        </div>
      )}

      <div className="flex flex-col gap-6 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
        <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display font-semibold tracking-tight">
              {nutritionTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <CompactNutrition
              calories={displayMacros?.calories || 0}
              protein={displayMacros?.protein || 0}
              carbs={displayMacros?.carbs || 0}
              fat={displayMacros?.fat || 0}
              targetCalories={targets.calories}
              targetProtein={targets.protein}
              targetCarbs={targets.carbs}
              targetFat={targets.fat}
              hasActivePlan={hasActivePlan}
            />
          </CardContent>
        </Card>

        <WeeklyMacroChart
          data={weeklyMacros}
          targetCalories={targets.calories}
          targetProtein={targets.protein}
          targetCarbs={targets.carbs}
          targetFat={targets.fat}
          highlightDate={highlightDate}
        />
      </div>

      <div className="lg:col-span-7 lg:col-start-1">
        <RecentRecipesCarousel recipes={recentRecipes || []} />
      </div>
    </div>
  );
}
