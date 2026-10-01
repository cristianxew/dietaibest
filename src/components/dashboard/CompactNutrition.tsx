"use client";

import { useFormatter, useTranslations } from "next-intl";
import Link from "next/link";
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from "recharts";
import { Button } from "@/components/ui/button";
import { Settings, ArrowRight } from "lucide-react";
import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";
import { cn } from "@/lib/utils";
import { getMacroBreakdown, type MacroKey } from "@/lib/macro-breakdown";

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

// Macro identity colours (design_system.md → "Macro Display Colors"). Fills
// read the theme tokens so the donut and bars follow dark mode; the labels use
// the darker Chip text shade so they stay ≥ 4.5:1 on the card.
const MACRO_STYLE: Record<MacroKey, { fill: string; textClass: string }> = {
  protein: { fill: "var(--color-slate-500)", textClass: "text-slate-600 dark:text-slate-400" },
  carbs: { fill: "var(--gold-500)", textClass: "text-gold-700 dark:text-gold-400" },
  fat: { fill: "var(--sage-500)", textClass: "text-sage-700 dark:text-sage-600" },
};

const EMPTY_RING = [{ name: "empty", value: 1, color: "var(--border)" }];

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
  const format = useFormatter();

  const hasTargets = targetCalories && targetProtein && targetCarbs && targetFat;
  const hasData = calories > 0 || protein > 0 || carbs > 0 || fat > 0;

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

  const breakdown = getMacroBreakdown(
    { calories, protein, carbs, fat },
    { calories: targetCalories, protein: targetProtein, carbs: targetCarbs, fat: targetFat }
  );
  const shareOf = (key: MacroKey) =>
    breakdown.macros.find((m) => m.key === key)!.share / 100;

  // Segments are sized by each macro's calories, not its grams.
  const chartData = breakdown.macros
    .filter((m) => m.kcal > 0)
    .map((m) => ({ name: m.key, value: m.kcal, color: MACRO_STYLE[m.key].fill }));
  const hasSegments = chartData.length > 0;
  const ringData = hasSegments ? chartData : EMPTY_RING;

  const kcalUnit = t("kcalUnit");
  const gramUnit = t("gramUnit");
  const totalKcal = Math.round(breakdown.totalKcal);

  return (
    <div className="flex flex-row items-center gap-5 sm:gap-6 py-4">
      {/* Donut: calorie composition, with the total in the centre */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div
          className="h-[90px] w-[90px]"
          {...(hasSegments
            ? {
                role: "img",
                "aria-label": t("calorieShares", {
                  protein: shareOf("protein"),
                  carbs: shareOf("carbs"),
                  fat: shareOf("fat"),
                }),
              }
            : { "aria-hidden": true })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ringData}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={42}
                paddingAngle={chartData.length > 1 ? 4 : 0}
                cornerRadius={6}
                dataKey="value"
                stroke="none"
                isAnimationActive={true}
              >
                {ringData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
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
                            y={(viewBox.cy || 0) - 5}
                            className="fill-foreground text-base font-bold tabular-nums"
                          >
                            {format.number(totalKcal)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 10}
                            className="fill-muted-foreground text-[11px] uppercase tracking-wide"
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
        </div>
        {breakdown.calorieProgress !== null && (
          <p className="max-w-24 text-center text-balance text-xs text-muted-foreground tabular-nums">
            {t("ofCalorieTarget", {
              progress: breakdown.calorieProgress / 100,
              target: targetCalories,
            })}
          </p>
        )}
      </div>

      {/* Macros: grams planned vs target, one row each */}
      <ul className="flex-1 min-w-0 space-y-3">
        {breakdown.macros.map((macro) => {
          const style = MACRO_STYLE[macro.key];
          return (
            <li key={macro.key} className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className={cn("text-xs font-medium", style.textClass)}>
                  {t(macro.key)}
                </span>
                <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                  {format.number(Math.round(macro.grams))}
                  {macro.target !== null && (
                    <span className="font-normal text-muted-foreground">
                      {" / "}
                      {format.number(macro.target)}
                    </span>
                  )}
                  <span className="font-normal text-muted-foreground"> {gramUnit}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden" aria-hidden>
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${Math.min(macro.progress ?? 0, 100)}%`,
                    backgroundColor: style.fill,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
