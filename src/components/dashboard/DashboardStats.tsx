"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, Heart, Calendar, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardStatsProps {
  totalRecipes: number;
  favoriteRecipes: number;
  totalMealPlans: number;
  activeSchedules: number;
}

export function DashboardStats({
  totalRecipes,
  favoriteRecipes,
  totalMealPlans,
  activeSchedules,
}: DashboardStatsProps) {
  const t = useTranslations("dashboard.quickStats");

  const stats = [
    {
      label: t("totalRecipes"),
      value: totalRecipes,
      icon: ChefHat,
      color: "brand",
    },
    {
      label: t("favorites"),
      value: favoriteRecipes,
      icon: Heart,
      color: "rose",
    },
    {
      label: t("mealPlans"),
      value: totalMealPlans,
      icon: Calendar,
      color: "gold",
    },
    {
      label: t("activeSchedules"),
      value: activeSchedules,
      icon: CalendarCheck,
      color: "sage",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string }> = {
      brand: {
        bg: "bg-brand-50 dark:bg-brand-950/30",
        icon: "text-brand-500 dark:text-brand-400",
      },
      rose: {
        bg: "bg-rose-50 dark:bg-rose-950/30",
        icon: "text-rose-500 dark:text-rose-400",
      },
      gold: {
        bg: "bg-gold-50 dark:bg-gold-950/30",
        icon: "text-gold-500 dark:text-gold-400",
      },
      sage: {
        bg: "bg-sage-50 dark:bg-sage-950/30",
        icon: "text-sage-500 dark:text-sage-400",
      },
    };
    return colors[color] || colors.brand;
  };

  return (
    <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display font-semibold tracking-tight">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {stats.map((stat, index) => {
          const colors = getColorClasses(stat.color);
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl transition-colors",
                "hover:bg-stone-50 dark:hover:bg-stone-800/50"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", colors.bg)}>
                  <Icon className={cn("h-4 w-4", colors.icon)} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </div>
              <span className="text-xl font-mono font-semibold text-foreground tabular-nums">
                {stat.value}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
