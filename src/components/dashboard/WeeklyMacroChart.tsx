"use client";

import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";
import type { WeeklyMacroData } from "@/actions/dashboard";

interface WeeklyMacroChartProps {
  data: WeeklyMacroData[];
  targetCalories?: number | null;
  targetProtein?: number | null;
  targetCarbs?: number | null;
  targetFat?: number | null;
  /** Date (YYYY-MM-DD) of the day selected in the plan card; defaults to today. */
  highlightDate?: string;
  className?: string;
}

type MacroType = "calories" | "protein" | "carbs" | "fat";

// Macro identity colours and order (design_system.md → "Macro Display Colors").
const MACRO_TYPES: MacroType[] = ["calories", "protein", "carbs", "fat"];
const MACRO_FILL: Record<MacroType, string> = {
  calories: "bg-brand-500",
  protein: "bg-slate-500",
  carbs: "bg-gold-500",
  fat: "bg-sage-500",
};

export function WeeklyMacroChart({
  data,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
  highlightDate,
  className,
}: WeeklyMacroChartProps) {
  const t = useTranslations("dashboard.weeklyChart");
  const format = useFormatter();
  const [activeMacro, setActiveMacro] = useState<MacroType>("calories");

  const fill = MACRO_FILL[activeMacro];
  const unit = activeMacro === "calories" ? t("unitKcal") : t("unitGrams");

  // Get target for current macro
  const getTarget = (macro: MacroType) => {
    switch (macro) {
      case "calories": return targetCalories;
      case "protein": return targetProtein;
      case "carbs": return targetCarbs;
      case "fat": return targetFat;
    }
  };

  const currentTarget = getTarget(activeMacro);

  // Calculate max value for bar scaling
  const maxValue = Math.max(
    ...data.map((d) => d[activeMacro]),
    currentTarget || 0
  );

  // Check if there's any data at all
  const hasAnyData = data.some((d) => d.hasData);

  const header = (
    <div className="space-y-1">
      <CardTitle className="text-lg font-display font-semibold tracking-tight">
        {t("title")}
      </CardTitle>
      <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
    </div>
  );

  if (!hasAnyData) {
    return (
      <Card className={cn("border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm", className)}>
        <CardHeader className="pb-3">{header}</CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <EmptyStateIcon icon={Calendar} size="sm" className="mb-3" />
            <p className="text-muted-foreground text-sm max-w-xs">
              {t("noDataDescription")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const highlighted = highlightDate ?? data.find((d) => d.isToday)?.date;

  return (
    <Card className={cn("border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm", className)}>
      <CardHeader className="pb-3">
        {/* When the card is narrow (phone, or the 5-column desktop slot) the toggle
            drops under the title so neither is squeezed. */}
        <div className="flex flex-col gap-3 @md/card-header:flex-row @md/card-header:items-start @md/card-header:justify-between">
          {header}

          {/* Macro toggle */}
          <div
            role="group"
            aria-label={t("toggleLabel")}
            className="flex w-full @md/card-header:w-auto gap-0.5 p-1 rounded-lg bg-stone-100 dark:bg-stone-800"
          >
            {MACRO_TYPES.map((macro) => (
              <Button
                key={macro}
                variant="ghost"
                size="sm"
                aria-pressed={activeMacro === macro}
                onClick={() => setActiveMacro(macro)}
                className={cn(
                  "h-7 grow @md/card-header:grow-0 gap-1 px-2 text-xs font-medium transition-all pointer-coarse:min-h-11",
                  activeMacro === macro
                    ? "bg-white dark:bg-stone-700 shadow-sm"
                    : "hover:bg-white/50 dark:hover:bg-stone-700/50"
                )}
              >
                <span
                  aria-hidden
                  className={cn("w-2 h-2 rounded-full shrink-0", MACRO_FILL[macro])}
                />
                {t(`toggle.${macro}`)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Horizontal Bar Chart */}
        <div className="space-y-2">
          {data.map((day) => {
            const value = day[activeMacro];
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
            const targetPercentage = currentTarget && maxValue > 0
              ? (currentTarget / maxValue) * 100
              : null;
            const isHighlighted = day.date === highlighted;

            return (
              <div
                key={day.date}
                aria-current={day.isToday ? "date" : undefined}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
                  isHighlighted && "bg-brand-50/50 dark:bg-brand-950/20 ring-1 ring-brand-200/50 dark:ring-brand-800/30"
                )}
              >
                {/* Day Label */}
                <div className="w-10 shrink-0">
                  <span className={cn(
                    "text-xs font-medium",
                    day.isToday ? "text-brand-700 dark:text-brand-600" : "text-muted-foreground"
                  )}>
                    {day.dayName}
                  </span>
                </div>

                {/* Bar Container */}
                <div className="flex-1 relative h-6">
                  {/* Background Track */}
                  <div className="absolute inset-0 bg-stone-100 dark:bg-stone-800 rounded-full" />

                  {/* Value Bar */}
                  {day.hasData && value > 0 && (
                    <div
                      className={cn(
                        "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
                        fill
                      )}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  )}

                  {/* Target Indicator */}
                  {targetPercentage && targetPercentage <= 100 && (
                    <div
                      className="absolute top-0 h-full w-0.5 bg-stone-400 dark:bg-stone-500"
                      style={{ left: `${targetPercentage}%` }}
                    >
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-b-[4px] border-transparent border-b-stone-400 dark:border-b-stone-500" />
                    </div>
                  )}
                </div>

                {/* Value Label: planned days at full strength, days without
                    meals (e.g. before the plan started) muted. */}
                <div className="w-20 text-right shrink-0">
                  {day.hasData ? (
                    <span className={cn(
                      "text-sm tabular-nums text-foreground",
                      day.isToday && "font-semibold"
                    )}>
                      {format.number(value)}
                      <span className="text-[11px] font-normal ml-0.5 text-muted-foreground">
                        {unit}
                      </span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      <span aria-hidden>—</span>
                      <span className="sr-only">{t("noMeals")}</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Target Legend */}
        {currentTarget && (
          <div className="flex items-center justify-end gap-2 pt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-stone-400 dark:bg-stone-500 rounded-full" />
              <span className="tabular-nums">
                {t("targetLabel")}: {format.number(currentTarget)} {unit}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
