import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, HeartPulse } from "lucide-react";
import { getMyWeekAnalysis } from "@/actions/nutrition-week";

/** Slim link from the meal planner into My Week — a link, not an embed. */
export async function PlannerNutritionBanner() {
  const t = await getTranslations("nutritionHub.myWeek.hero");

  let count: number | null = null;
  try {
    const result = await getMyWeekAnalysis();
    if (result.error === null && result.data.hasActivePlan) {
      count = result.data.analysis.findings.length;
    }
  } catch {
    return null;
  }
  if (count === null || count === 0) return null;

  return (
    <div className="px-4 pt-4 sm:px-6">
      <Link
        href="/nutrition/my-week"
        className="flex items-center justify-between gap-3 rounded-xl border border-gold-300/60 dark:border-gold-500/30 bg-gold-50/60 dark:bg-gold-500/10 px-4 py-2.5 text-sm hover:bg-gold-100/60 dark:hover:bg-gold-500/15 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <HeartPulse className="w-4 h-4 text-gold-600 dark:text-gold-400 shrink-0" />
          <span className="truncate font-medium">{t("findings", { count })}</span>
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-gold-700 dark:text-gold-300 shrink-0">
          {t("cta")}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
}
