"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CompactNutrition } from "./CompactNutrition";
import { WeeklyMacroChart } from "./WeeklyMacroChart";
import { ActivePlanPreview, ActivePlanEmpty } from "./ActivePlanPreview";
import { RecentRecipesCarousel } from "./RecentRecipesCarousel";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface InteractiveDashboardGridProps {
  todaysMacros: any;
  weeklyMacros: any;
  activePlan: any;
  profile: any;
  recentRecipes: any;
  hasActivePlan: boolean;
}

export function InteractiveDashboardGrid({
  todaysMacros,
  weeklyMacros,
  activePlan,
  profile,
  recentRecipes,
  hasActivePlan,
}: InteractiveDashboardGridProps) {
  const t = useTranslations("dashboard");
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

  const isToday = selectedDayNumber === activePlan?.currentDayNumber;
  const nutritionTitle = isToday
    ? t("todaysMacros.title") || "Today's Nutrition"
    : `Day ${selectedDayNumber} Nutrition`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column - Nutrition & Quick Actions */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-6 h-full">
        {/* Compact Nutrition Card */}
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
              targetCalories={displayMacros?.targetCalories || null}
              targetProtein={displayMacros?.targetProtein || null}
              targetCarbs={displayMacros?.targetCarbs || null}
              targetFat={displayMacros?.targetFat || null}
              hasActivePlan={hasActivePlan}
            />
          </CardContent>
        </Card>

        {/* Weekly Progress */}
        <WeeklyMacroChart
          data={weeklyMacros}
          targetCalories={profile?.dailyCalories || null}
          targetProtein={profile?.proteinGrams || null}
          targetCarbs={profile?.carbsGrams || null}
          targetFat={profile?.fatGrams || null}
          className="flex-1"
        />
      </div>

      {/* Right Column - Active Plan & Recent Recipes */}
      <div className="lg:col-span-6 xl:col-span-7 space-y-6">
        {/* Active Plan Card */}
        {hasActivePlan && activePlan ? (
          <div className="relative group">
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
          <ActivePlanEmpty />
        )}

        {/* Recent Recipes */}
        <RecentRecipesCarousel recipes={recentRecipes || []} />
      </div>
    </div>
  );
}
