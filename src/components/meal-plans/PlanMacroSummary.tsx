"use client";

import { cn } from "@/lib/utils";
import { calculateWeeklyMacros, getProgressPercentage } from "@/lib/meal-plan-macros";
import type { MealPlanTemplateDisplay } from "@/types/meal-plan";
import { useTranslations } from "next-intl";

interface PlanMacroSummaryProps {
  template: MealPlanTemplateDisplay;
}

/**
 * Plan-level macro summary: each metric is the plan's daily average against
 * the daily target, so plans of any length read the same way as a day.
 */
export function PlanMacroSummary({ template }: PlanMacroSummaryProps) {
  const t = useTranslations("mealPlans");
  const { averageDailyMacros } = calculateWeeklyMacros(template.days);
  const targets = template.targets;

  const metrics = [
    {
      label: t("macroLabels.calories"),
      value: Math.round(averageDailyMacros.calories),
      target: targets?.calories ?? 0,
      unit: "kcal",
      barColor: "bg-brand-500",
    },
    {
      label: t("macroLabels.protein"),
      value: Math.round(averageDailyMacros.protein),
      target: targets?.protein ?? 0,
      unit: "g",
      barColor: "bg-slate-500",
    },
    {
      label: t("macroLabels.carbs"),
      value: Math.round(averageDailyMacros.carbs),
      target: targets?.carbs ?? 0,
      unit: "g",
      barColor: "bg-gold-500",
    },
    {
      label: t("macroLabels.fat"),
      value: Math.round(averageDailyMacros.fat),
      target: targets?.fat ?? 0,
      unit: "g",
      barColor: "bg-sage-500",
    },
  ];

  return (
    <div
      className={cn(
        "grid gap-x-3 gap-y-2.5 p-3.5 sm:gap-x-3.5 sm:gap-y-3 sm:p-4 lg:gap-y-4 lg:px-[18px] lg:py-3.5",
        "grid-cols-2 sm:grid-cols-4 lg:grid-cols-[1fr_repeat(4,minmax(120px,160px))]",
        "bg-card border border-border rounded-xl"
      )}
    >
      {/* Label block — a single line below lg */}
      <div className="col-span-2 sm:col-span-4 lg:col-span-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 lg:block">
        <div className="text-[11px] touch:text-xs font-bold tracking-[0.12em] uppercase text-muted-foreground lg:mb-1">
          {t("planSummary")}
        </div>
        <div className="text-xs text-muted-foreground">
          {t("dailyAverageForDays", { days: template.days.length })}
        </div>
      </div>

      {/* Metric cells: daily average / daily target */}
      {metrics.map((m) => {
        const pct = getProgressPercentage(m.value, m.target);
        const hasTarget = m.target > 0;

        return (
          <div key={m.label}>
            <div className="flex justify-between items-baseline mb-0.5 lg:mb-1">
              <span className="text-[11px] touch:text-xs font-bold tracking-[0.1em] uppercase text-muted-foreground">
                {m.label}
              </span>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-[5px] mb-1 lg:mb-[5px]">
              <span className="font-mono text-[18px] max-lg:leading-none font-medium text-foreground">
                {m.value.toLocaleString()}
              </span>
              {/* Below lg the unit is shown once ("/ 2,650 kcal") so the
                  value and target fit on one line in the narrow columns */}
              {hasTarget ? (
                <span className="text-[11px] touch:text-xs text-muted-foreground">
                  <span className="max-lg:hidden">{m.unit} </span>/ {m.target.toLocaleString()}
                  <span className="lg:hidden"> </span>
                  {m.unit}
                </span>
              ) : (
                <span className="text-[11px] touch:text-xs text-muted-foreground">{m.unit}</span>
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
