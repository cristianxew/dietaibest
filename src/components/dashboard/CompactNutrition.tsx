"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";
import { Button } from "@/components/ui/button";
import { Settings, ArrowRight } from "lucide-react";
import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";

interface CompactNutritionProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  hasActivePlan: boolean;
}

export function CompactNutrition({
  calories,
  protein,
  carbs,
  fat,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
  hasActivePlan,
}: CompactNutritionProps) {
  const t = useTranslations("dashboard.todaysMacros");

  const hasTargets = targetCalories && targetProtein && targetCarbs && targetFat;
  const hasData = calories > 0 || protein > 0 || carbs > 0 || fat > 0;

  // Calculate percentages based on standard caloric values
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;
  const totalMacroCals = proteinCals + carbsCals + fatCals;
  const displayCals = calories || totalMacroCals;

  const getPercent = (grams: number, calsPerGram: number) => {
    if (!displayCals) return 0;
    return Math.round(((grams * calsPerGram) / displayCals) * 100);
  };

  const getTargetPercent = (current: number, target: number | null) => {
    if (!target) return 0;
    return Math.min(Math.round((current / target) * 100), 999);
  };

  // If no targets, show setup prompt
  if (!hasTargets) {
    return (
      <div className="flex items-center justify-between py-4 px-2">
        <div className="flex items-center gap-4">
          <EmptyStateIcon icon={Settings} size="sm" />
          <p className="text-sm text-muted-foreground max-w-[200px]">
            {t("noTargets")}
          </p>
        </div>
        <Button asChild size="sm" className="shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
          <Link href="/profile" className="gap-2">
            {t("setupTargets")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // If no data and no active plan
  if (!hasData && !hasActivePlan) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        {t("noData")}
      </div>
    );
  }

  const stats = [
    {
      label: t("carbs"),
      value: carbs,
      target: targetCarbs,
      unit: "g",
      color: "#D4A017", // Gold
      percent: getPercent(carbs, 4),
    },
    {
      label: t("fat"),
      value: fat,
      target: targetFat,
      unit: "g",
      color: "#4A7C59", // Sage
      percent: getPercent(fat, 9),
    },
    {
      label: t("protein"),
      value: protein,
      target: targetProtein,
      unit: "g",
      color: "#3B82F6", // Blue
      percent: getPercent(protein, 4),
    },
  ];

  const chartData = stats.map((s) => ({
    name: s.label,
    value: s.value || 1,
    color: s.color,
  }));

  const caloriePercent = getTargetPercent(calories, targetCalories);
  const kcalUnit = t("kcalUnit");

  return (
    <div className="flex flex-row items-center gap-6 sm:gap-8 py-6">
      {/* Donut Chart */}
      <div className="h-[90px] w-[90px] relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={hasData ? chartData : [{ name: "Empty", value: 1, color: "#E8E4DD" }]}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={42}
              paddingAngle={hasData ? 4 : 0}
              cornerRadius={6}
              dataKey="value"
              stroke="none"
              isAnimationActive={true}
            >
              {(hasData ? chartData : [{ color: "#E8E4DD" }]).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 4}
                          className="fill-foreground text-base font-bold font-display"
                        >
                          {displayCals.toFixed(0)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 10}
                          className="fill-muted-foreground text-[8px] uppercase tracking-wider"
                        >
                          {kcalUnit}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Target percentage badge */}
        {targetCalories && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-medium">
            {caloriePercent}%
          </div>
        )}
      </div>

      {/* Stats Columns */}
      <div className="flex items-center gap-4 sm:gap-6 md:gap-8 flex-wrap">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col items-center gap-0.5 min-w-[50px]">
            <span className="text-lg sm:text-xl font-bold font-display text-foreground tabular-nums">
              {stat.value?.toFixed(0)}
              <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-0.5">
                {stat.unit}
              </span>
            </span>
            <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
              {stat.label}
            </span>
            <span
              className="text-[10px] font-semibold tabular-nums"
              style={{ color: stat.color }}
            >
              {stat.percent}%
            </span>
            {stat.target && (
              <span className="text-[9px] text-muted-foreground/70 tabular-nums">
                /{stat.target}{stat.unit}
              </span>
            )}
          </div>
        )
        )}
      </div>
    </div>
  );
}
