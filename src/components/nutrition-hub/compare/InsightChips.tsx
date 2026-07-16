"use client";

import { useTranslations } from "next-intl";
import { Leaf, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/nutrients/insights";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import { displayUnit } from "@/components/nutrition-hub/format";

interface InsightChipsProps {
  insights: Insight[];
  labelA: string;
  labelB: string;
  maxChips?: number;
}

/**
 * Top comparison verdicts as localized pills. The engine emits structured
 * data; the sentence is assembled here via ICU messages so all three
 * locales read naturally.
 */
export function InsightChips({
  insights,
  labelA,
  labelB,
  maxChips = 4,
}: InsightChipsProps) {
  const t = useTranslations("nutritionHub.insights");
  const tNutrients = useTranslations("nutritionHub.nutrients");

  if (insights.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:snap-x max-sm:pb-2">
      {insights.slice(0, maxChips).map((insight, i) => {
        const winnerLabel = insight.winner === "a" ? labelA : labelB;
        const nutrientName = tNutrients(`${insight.nutrient}.name`);
        const unit = displayUnit(NUTRIENT_REGISTRY[insight.nutrient].unit);

        const sentence =
          insight.kind === "timesMore"
            ? t("timesMore", {
                winner: winnerLabel,
                times: insight.times ?? 0,
                nutrient: nutrientName,
              })
            : insight.kind === "moreBy"
              ? t("moreBy", {
                  winner: winnerLabel,
                  diff: insight.diff ?? 0,
                  unit,
                  nutrient: nutrientName,
                })
              : t("onlyOneHas", {
                  winner: winnerLabel,
                  nutrient: nutrientName,
                });

        return (
          <span
            key={`${insight.nutrient}-${insight.winner}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
              "animate-fade-up max-sm:snap-start max-sm:shrink-0",
              insight.sentiment === "positive"
                ? "bg-sage-50 text-sage-700 border-sage-200 dark:bg-sage-500/10 dark:text-sage-300 dark:border-sage-500/20"
                : "bg-gold-50 text-gold-700 border-gold-200 dark:bg-gold-500/10 dark:text-gold-300 dark:border-gold-500/20"
            )}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            {insight.sentiment === "positive" ? (
              <Leaf className="w-3 h-3 shrink-0" />
            ) : (
              <TriangleAlert className="w-3 h-3 shrink-0" />
            )}
            {sentence}
          </span>
        );
      })}
    </div>
  );
}
