"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_NUTRIENT_KEYS,
  NUTRIENT_REGISTRY,
  type NutrientKey,
} from "@/lib/nutrients/registry";
import type { WeekAnalysis } from "@/lib/nutrients/week-analysis";

function cellClass(key: NutrientKey, fill: number | undefined): string {
  if (fill === undefined) return "text-muted-foreground";
  const limit = NUTRIENT_REGISTRY[key].direction === "limit";
  if (limit) {
    return fill > 1
      ? "bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300"
      : "bg-sage-50 dark:bg-sage-500/10";
  }
  if (fill >= 0.7) return "bg-sage-50 dark:bg-sage-500/10";
  return "bg-gold-50 dark:bg-gold-500/10 text-gold-700 dark:text-gold-400";
}

export function WeekHeatmap({ analysis }: { analysis: WeekAnalysis }) {
  const t = useTranslations("nutritionHub.myWeek.detail");
  const tNutrients = useTranslations("nutritionHub.nutrients");
  const [open, setOpen] = useState(false);
  const plannedDays = analysis.days.filter((d) => d.planned);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium"
      >
        {open ? t("hide") : t("show")}
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground py-1.5 pr-3">
                  {t("nutrient")}
                </th>
                {plannedDays.map((d) => (
                  <th
                    key={d.date}
                    className="font-mono font-normal text-muted-foreground px-1.5"
                  >
                    {d.date.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_NUTRIENT_KEYS.map((key) => (
                <tr key={key} className="border-t border-border/50">
                  <td className="py-1.5 pr-3 whitespace-nowrap">
                    {tNutrients(`${key}.name`)}
                  </td>
                  {plannedDays.map((d) => {
                    const fill = d.fill[key];
                    return (
                      <td
                        key={d.date}
                        className={cn(
                          "text-center font-mono px-1.5 py-1.5 rounded",
                          cellClass(key, fill)
                        )}
                      >
                        {fill === undefined ? "—" : `${Math.round(fill * 100)}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
