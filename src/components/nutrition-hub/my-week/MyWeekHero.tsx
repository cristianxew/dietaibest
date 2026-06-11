import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarRange } from "lucide-react";
import { getMyWeekAnalysis } from "@/actions/nutrition-week";

/** Landing hero: live one-line verdict of the user's planned week. */
export async function MyWeekHero() {
  const t = await getTranslations("nutritionHub.myWeek.hero");

  let line: string | null = null;
  try {
    const result = await getMyWeekAnalysis();
    if (result.error === null && result.data.hasActivePlan) {
      const count = result.data.analysis.findings.length;
      line = count === 0 ? t("ok") : t("findings", { count });
    }
  } catch {
    return null;
  }
  if (line === null) return null;

  return (
    <Link
      href="/nutrition/my-week"
      className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-sage-300/60 dark:border-sage-500/40 bg-sage-50/50 dark:bg-sage-500/10 p-5 transition-colors hover:bg-sage-100/60 dark:hover:bg-sage-500/15"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-sage-100 dark:bg-sage-500/20 shrink-0">
          <CalendarRange className="w-5 h-5 text-sage-600 dark:text-sage-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sage-600 dark:text-sage-400">
            {t("eyebrow")}
          </p>
          <p className="font-display font-bold truncate">{line}</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-sage-700 dark:text-sage-300 shrink-0">
        {t("cta")}
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
