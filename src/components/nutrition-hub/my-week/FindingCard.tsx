"use client";

import { useTranslations } from "next-intl";
import { TrendingDown, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import type { Finding } from "@/lib/nutrients/week-analysis";
import { formatNutrientAmount } from "@/components/nutrition-hub/format";

interface FindingCardProps {
  finding: Finding;
  allFindings: Finding[];
  onChanged: () => Promise<void>;
}

export function FindingCard({ finding }: FindingCardProps) {
  const t = useTranslations("nutritionHub.myWeek.findings");
  const tNutrients = useTranslations("nutritionHub.nutrients");
  const nutrientName = tNutrients(`${finding.nutrient}.name`);
  const isExcess = finding.kind === "excess";
  const unit = NUTRIENT_REGISTRY[finding.nutrient].unit;
  const gapText = formatNutrientAmount(finding.weekGapAmount, unit);

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 space-y-4",
        isExcess
          ? "border-brand-200 dark:border-brand-500/30"
          : "border-gold-200 dark:border-gold-500/30"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isExcess ? (
            <TriangleAlert className="w-4 h-4 text-brand-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-gold-600 dark:text-gold-400" />
          )}
          <h3 className="font-display font-bold text-lg">
            {t(isExcess ? "excessTitle" : "deficitTitle", { nutrient: nutrientName })}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(isExcess ? "excessMeta" : "deficitMeta", {
            days: finding.daysAffected,
            plannedDays: finding.plannedDays,
          })}
          {" · "}
          {t(isExcess ? "weekGapExcess" : "weekGapDeficit", { amount: gapText })}
        </p>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t(isExcess ? "sourcesExcess" : "sourcesDeficit")}
        </p>
        {finding.topContributors.map((c) => (
          <div
            key={c.mealId}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <span className="truncate">{c.recipeTitle}</span>
            {isExcess && c.share > 0 && (
              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {t("contributorShare", { share: Math.round(c.share * 100) })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
