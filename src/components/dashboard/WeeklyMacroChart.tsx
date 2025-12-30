"use client";

import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  className?: string;
}

type MacroType = "calories" | "protein" | "carbs" | "fat";

const macroConfig: Record<
  MacroType,
  { color: string; bgColor: string; label: string; unit: string }
> = {
  calories: {
    color: "#E07A5F",
    bgColor: "bg-brand-500",
    label: "Cal",
    unit: "kcal",
  },
  protein: {
    color: "#3B82F6",
    bgColor: "bg-blue-500",
    label: "Pro",
    unit: "g",
  },
  carbs: {
    color: "#D4A017",
    bgColor: "bg-gold-500",
    label: "Carb",
    unit: "g",
  },
  fat: {
    color: "#4A7C59",
    bgColor: "bg-sage-500",
    label: "Fat",
    unit: "g",
  },
};

export function WeeklyMacroChart({
  data,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
  className,
}: WeeklyMacroChartProps) {
  const t = useTranslations("dashboard.weeklyChart");
  const [activeMacro, setActiveMacro] = useState<MacroType>("calories");

  const config = macroConfig[activeMacro];

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

  if (!hasAnyData) {
    return (
      <Card className={cn("border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display font-semibold tracking-tight">
            {t("title")}
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </CardHeader>
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

  return (
    <Card className={cn("border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg font-display font-semibold tracking-tight">
              {t("title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </div>

          {/* Compact Macro Toggle */}
          <div className="flex gap-0.5 p-1 rounded-lg bg-stone-100 dark:bg-stone-800">
            {(Object.keys(macroConfig) as MacroType[]).map((macro) => (
              <Button
                key={macro}
                variant="ghost"
                size="sm"
                onClick={() => setActiveMacro(macro)}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium transition-all",
                  activeMacro === macro
                    ? "bg-white dark:bg-stone-700 shadow-sm"
                    : "hover:bg-white/50 dark:hover:bg-stone-700/50"
                )}
              >
                <div
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: macroConfig[macro].color }}
                />
                {macroConfig[macro].label}
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

            return (
              <div
                key={day.date}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
                  day.isToday && "bg-brand-50/50 dark:bg-brand-950/20 ring-1 ring-brand-200/50 dark:ring-brand-800/30",
                  day.isFuture && "opacity-50"
                )}
              >
                {/* Day Label */}
                <div className="w-10 shrink-0">
                  <span className={cn(
                    "text-xs font-medium",
                    day.isToday ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground"
                  )}>
                    {day.dayName}
                  </span>
                </div>

                {/* Bar Container */}
                <div className="flex-1 relative h-6">
                  {/* Background Track */}
                  <div className="absolute inset-0 bg-stone-100 dark:bg-stone-800 rounded-full" />

                  {/* Value Bar */}
                  {value > 0 && (
                    <div
                      className={cn(
                        "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
                        config.bgColor,
                        day.isFuture && "opacity-40"
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

                {/* Value Label */}
                <div className="w-20 text-right shrink-0">
                  {day.hasData || !day.isFuture ? (
                    <span className={cn(
                      "text-sm font-mono tabular-nums",
                      day.isToday ? "font-semibold text-foreground" : "text-muted-foreground"
                    )}>
                      {value > 0 ? value.toLocaleString() : "—"}
                      {value > 0 && (
                        <span className="text-[10px] ml-0.5 text-muted-foreground">
                          {config.unit}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Target Legend */}
        {currentTarget && (
          <div className="flex items-center justify-end gap-2 pt-2 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-0.5 h-3 bg-stone-400 dark:bg-stone-500 rounded-full" />
              <span>{t("targetLabel")}: {currentTarget.toLocaleString()} {config.unit}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
