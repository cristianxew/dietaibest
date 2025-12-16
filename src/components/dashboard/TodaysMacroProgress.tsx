"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Flame, Beef, Wheat, Droplets, ArrowRight, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface TodaysMacroProgressProps {
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

export function TodaysMacroProgress({
  calories,
  protein,
  carbs,
  fat,
  targetCalories,
  targetProtein,
  targetCarbs,
  targetFat,
  hasActivePlan,
}: TodaysMacroProgressProps) {
  const t = useTranslations("dashboard.todaysMacros");

  // Check if user has targets set
  const hasTargets = targetCalories && targetProtein && targetCarbs && targetFat;

  // Calculate percentages
  const getPercentage = (current: number, target: number | null) => {
    if (!target) return 0;
    return Math.min(Math.round((current / target) * 100), 150);
  };

  const getStatus = (percentage: number) => {
    if (percentage >= 90 && percentage <= 110) return "onTrack";
    if (percentage < 90) return "under";
    return "over";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "onTrack":
        return "bg-gradient-to-r from-sage-500 to-sage-400 shadow-lg shadow-sage-500/20";
      case "under":
        return "bg-gradient-to-r from-gold-500 to-gold-400 shadow-lg shadow-gold-500/20";
      case "over":
        return "bg-gradient-to-r from-brand-500 to-brand-400 shadow-lg shadow-brand-500/20";
      default:
        return "bg-stone-400";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "onTrack":
        return "bg-sage-50 dark:bg-sage-950/50 text-sage-700 dark:text-sage-300 border-sage-200 dark:border-sage-800";
      case "under":
        return "bg-gold-50 dark:bg-gold-950/50 text-gold-700 dark:text-gold-300 border-gold-200 dark:border-gold-800";
      case "over":
        return "bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-800";
      default:
        return "";
    }
  };

  const macros = [
    {
      key: "calories",
      label: t("calories"),
      current: calories,
      target: targetCalories,
      unit: "kcal",
      icon: Flame,
      color: "brand",
      bgColor: "bg-brand-500",
      lightBg: "bg-brand-100 dark:bg-brand-900/30",
      iconColor: "text-brand-500",
    },
    {
      key: "protein",
      label: t("protein"),
      current: protein,
      target: targetProtein,
      unit: "g",
      icon: Beef,
      color: "blue",
      bgColor: "bg-blue-500",
      lightBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-500",
    },
    {
      key: "carbs",
      label: t("carbs"),
      current: carbs,
      target: targetCarbs,
      unit: "g",
      icon: Wheat,
      color: "gold",
      bgColor: "bg-gold-500",
      lightBg: "bg-gold-100 dark:bg-gold-900/30",
      iconColor: "text-gold-500",
    },
    {
      key: "fat",
      label: t("fat"),
      current: fat,
      target: targetFat,
      unit: "g",
      icon: Droplets,
      color: "sage",
      bgColor: "bg-sage-500",
      lightBg: "bg-sage-100 dark:bg-sage-900/30",
      iconColor: "text-sage-500",
    },
  ];

  // If no targets, show setup prompt
  if (!hasTargets) {
    return (
      <div className="text-center py-6 space-y-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-900/30 dark:to-gold-900/30">
          <Settings className="h-7 w-7 text-brand-500" />
        </div>
        <div className="space-y-2">
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            {t("noTargets")}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/profile" className="gap-2">
            {t("setupTargets")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // If no active plan and no data
  const hasData = calories > 0 || protein > 0 || carbs > 0 || fat > 0;

  return (
    <div className="space-y-4">
      {/* View Plan link for active plans */}
      {hasActivePlan && (
        <div className="flex justify-end">
          <Button asChild variant="ghost" size="sm" className="text-xs -mt-2">
            <Link href="/meal-plans" className="gap-1">
              {t("viewPlan")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      )}

      {!hasData && !hasActivePlan ? (
        <div className="text-center py-6 text-muted-foreground text-sm">
          {t("noData")}
        </div>
      ) : (
        macros.map((macro, index) => {
          const percentage = getPercentage(macro.current, macro.target);
          const status = getStatus(percentage);
          const Icon = macro.icon;

          return (
            <div
              key={macro.key}
              className="space-y-1.5"
              style={{ animationDelay: `${index * 75}ms` }}
            >
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded-lg", macro.lightBg)}>
                    <Icon className={cn("h-3.5 w-3.5", macro.iconColor)} />
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {macro.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono tabular-nums text-foreground">
                    {macro.current}
                    <span className="text-muted-foreground">
                      /{macro.target}
                    </span>
                    <span className="text-xs text-muted-foreground ml-0.5">
                      {macro.unit}
                    </span>
                  </span>
                  {hasData && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        getStatusBadgeClass(status)
                      )}
                    >
                      {t(status)}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative">
                <Progress
                  value={Math.min(percentage, 100)}
                  className="h-2"
                  indicatorClassName={cn(
                    getStatusColor(status),
                    "transition-all duration-500"
                  )}
                />
                {percentage > 100 && (
                  <div
                    className="absolute top-0 right-0 h-2 rounded-r-full bg-brand-600"
                    style={{
                      width: `${Math.min(percentage - 100, 50)}%`,
                      opacity: 0.7,
                    }}
                  />
                )}
              </div>

              {/* Percentage label */}
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground">
                  {percentage}% {t("ofTarget")}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
