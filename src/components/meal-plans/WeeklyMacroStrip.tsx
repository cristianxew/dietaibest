"use client";

import { cn } from "@/lib/utils";
import { calculateWeeklyMacros, getProgressPercentage } from "@/lib/meal-plan-macros";
import type { MealPlanTemplateDisplay } from "@/types/meal-plan";
import { useTranslations } from "next-intl";

interface WeeklyMacroStripProps {
  template: MealPlanTemplateDisplay;
}

export function WeeklyMacroStrip({ template }: WeeklyMacroStripProps) {
  const t = useTranslations("mealPlans");
  const weekly = calculateWeeklyMacros(template.days);
  const { totalMacros, averageDailyMacros } = weekly;
  const duration = template.duration;

  const weeklyCaloriesTarget = (template.targets?.calories ?? 0) * duration;
  const weeklyProteinTarget = (template.targets?.protein ?? 0) * duration;
  const weeklyCarbsTarget = (template.targets?.carbs ?? 0) * duration;
  const weeklyFatTarget = (template.targets?.fat ?? 0) * duration;

  const metrics = [
    {
      label: t("macroLabels.calories"),
      value: Math.round(totalMacros.calories),
      target: weeklyCaloriesTarget,
      unit: "kcal",
      barColor: "bg-brand-500",
    },
    {
      label: t("macroLabels.protein"),
      value: Math.round(totalMacros.protein),
      target: weeklyProteinTarget,
      unit: "g",
      barColor: "bg-brand-500",
    },
    {
      label: t("macroLabels.carbs"),
      value: Math.round(totalMacros.carbs),
      target: weeklyCarbsTarget,
      unit: "g",
      barColor: "bg-gold-500",
    },
    {
      label: t("macroLabels.fat"),
      value: Math.round(totalMacros.fat),
      target: weeklyFatTarget,
      unit: "g",
      barColor: "bg-sage-500",
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-x-3.5 gap-y-4 px-4 sm:px-[18px] py-3.5",
        "grid-cols-2 lg:grid-cols-[1fr_repeat(4,minmax(120px,160px))]",
        "bg-card border border-border rounded-xl"
      )}
    >
      {/* Label block */}
      <div className="col-span-2 lg:col-span-1">
        <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-muted-foreground mb-1">
          {t("weeklySummary")}
        </div>
        <div className="text-[12px] text-muted-foreground">
          {t("dailyAverageWithCalories", { calories: Math.round(averageDailyMacros.calories) })}
        </div>
      </div>

      {/* Metric cells */}
      {metrics.map((m) => {
        const pct = getProgressPercentage(m.value, m.target);
        const hasTarget = m.target > 0;

        return (
          <div key={m.label}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-muted-foreground">
                {m.label}
              </span>
            </div>
            <div className="flex items-baseline gap-[5px] mb-[5px]">
              <span className="font-mono text-[18px] font-medium text-foreground">
                {m.value.toLocaleString()}
              </span>
              {hasTarget && (
                <span className="text-[10px] text-muted-foreground">
                  {m.unit} / {m.target.toLocaleString()}
                  {m.unit}
                </span>
              )}
            </div>
            <div className="h-[4px] bg-muted rounded-full overflow-hidden">
              {hasTarget && (
                <div
                  className={cn("h-full rounded-full transition-[width] duration-[600ms]", m.barColor)}
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
