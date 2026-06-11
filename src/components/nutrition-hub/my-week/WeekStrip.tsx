"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NUTRIENT_REGISTRY, type NutrientKey } from "@/lib/nutrients/registry";
import type { DayAnalysis } from "@/lib/nutrients/week-analysis";

type DayStatus = "good" | "watch" | "over" | "unplanned";

function dayStatus(day: DayAnalysis): DayStatus {
  if (!day.planned || day.meals.length === 0) return "unplanned";
  for (const [key, fill] of Object.entries(day.fill) as [NutrientKey, number][]) {
    if (NUTRIENT_REGISTRY[key].direction === "limit" && fill > 1) return "over";
  }
  const kcal = day.fill.kcal;
  if (kcal !== undefined && (kcal < 0.7 || kcal > 1.15)) return "watch";
  return "good";
}

const STATUS_RING: Record<DayStatus, string> = {
  good: "border-sage-300 dark:border-sage-500/40 bg-sage-50/50 dark:bg-sage-500/10",
  watch: "border-gold-300 dark:border-gold-500/40 bg-gold-50/50 dark:bg-gold-500/10",
  over: "border-brand-300 dark:border-brand-500/40 bg-brand-50/50 dark:bg-brand-500/10",
  unplanned: "border-dashed border-border bg-muted/30",
};

export function WeekStrip({ days }: { days: DayAnalysis[] }) {
  const locale = useLocale();
  const t = useTranslations("nutritionHub.myWeek.strip");
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "short" });

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((day) => {
        const status = dayStatus(day);
        // parse as local date (avoid UTC shift of new Date("YYYY-MM-DD"))
        const [y, m, d] = day.date.split("-").map(Number);
        return (
          <div
            key={day.date}
            className={cn(
              "rounded-xl border px-1 py-2 text-center",
              STATUS_RING[status]
            )}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {dayName.format(new Date(y, m - 1, d))}
            </p>
            {status === "unplanned" ? (
              <p className="text-[10px] text-muted-foreground mt-1">
                {t("unplanned")}
              </p>
            ) : (
              <p className="font-mono text-xs mt-1">
                {day.totals.kcal !== undefined
                  ? t("kcalShort", { kcal: Math.round(day.totals.kcal) })
                  : "—"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
