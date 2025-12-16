"use client";

import { useTranslations } from "next-intl";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface CalorieRingChartProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  targetCalories: number | null;
}

export function CalorieRingChart({
  calories,
  protein,
  carbs,
  fat,
  targetCalories,
}: CalorieRingChartProps) {
  const t = useTranslations("dashboard.todaysMacros");

  // Calculate calories from macros
  const proteinCals = protein * 4;
  const carbsCals = carbs * 4;
  const fatCals = fat * 9;

  const hasData = proteinCals > 0 || carbsCals > 0 || fatCals > 0;

  // Data for the donut chart
  const data = hasData
    ? [
      { name: "Protein", value: proteinCals, color: "#3B82F6" }, // blue
      { name: "Carbs", value: carbsCals, color: "#D4A017" }, // gold
      { name: "Fat", value: fatCals, color: "#4A7C59" }, // sage
    ]
    : [{ name: "Empty", value: 1, color: "#E8E4DD" }];

  // Calculate percentage of target
  const percentage = targetCalories
    ? Math.round((calories / targetCalories) * 100)
    : 0;
  const remaining = targetCalories ? Math.max(targetCalories - calories, 0) : 0;

  return (
    <div className="relative">
      {/* Chart */}
      <div className="h-44 w-44 mx-auto">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="shadow" />
                <feOffset dx="0" dy="4" result="offsetShadow" />
                <feComposite in2="offsetShadow" in="SourceAlpha" operator="in" result="innerShadow" />
                <feColorMatrix
                  type="matrix"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.2 0"
                  in="offsetShadow"
                  result="finalShadow"
                />
                <feBlend in="SourceGraphic" in2="finalShadow" mode="normal" />
              </filter>
            </defs>
            {/* Background ring */}
            <Pie
              data={[{ value: 100 }]}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={68}
              dataKey="value"
              stroke="none"
            >
              <Cell fill="currentColor" className="text-stone-100 dark:text-stone-800/50" />
            </Pie>

            {/* Data ring */}
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={68}
              paddingAngle={hasData ? 4 : 0}
              dataKey="value"
              cornerRadius={4}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              animationBegin={0}
              animationDuration={1000}
              filter="url(#shadow)"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  className="transition-all duration-300 outline-none focus:outline-none"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-mono font-bold text-foreground tabular-nums">
            {calories}
          </span>
          <span className="text-xs text-muted-foreground">
            {targetCalories ? `/ ${targetCalories}` : ""} kcal
          </span>
          {targetCalories && (
            <span
              className={cn(
                "text-xs font-medium mt-1",
                percentage >= 90 && percentage <= 110
                  ? "text-sage-600 dark:text-sage-400"
                  : percentage < 90
                    ? "text-gold-600 dark:text-gold-400"
                    : "text-brand-600 dark:text-brand-400"
              )}
            >
              {percentage}%
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      {hasData && (
        <div className="flex justify-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs text-muted-foreground">{t("protein")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-gold-500" />
            <span className="text-xs text-muted-foreground">{t("carbs")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-sage-500" />
            <span className="text-xs text-muted-foreground">{t("fat")}</span>
          </div>
        </div>
      )}

      {/* Remaining calories */}
      {targetCalories && remaining > 0 && (
        <div className="text-center mt-3">
          <span className="text-sm text-muted-foreground">
            <span className="font-mono font-medium text-foreground">{remaining}</span>{" "}
            {t("remaining")}
          </span>
        </div>
      )}
    </div>
  );
}
