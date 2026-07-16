import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CalendarRange, CalendarPlus } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { getMyWeekAnalysis } from "@/actions/nutrition-week";
import { MyWeekBoard } from "@/components/nutrition-hub/my-week/MyWeekBoard";
import { EducationalDisclaimer } from "@/components/nutrition-hub/shared/EducationalDisclaimer";

export default async function MyWeekPage() {
  const t = await getTranslations("nutritionHub.myWeek");
  const result = await getMyWeekAnalysis();

  return (
    <div className="min-h-screen relative bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sage-100/30 dark:bg-sage-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-brand-100/20 dark:bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        <div className="space-y-3 animate-fade-up">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sage-100 to-sage-50 dark:from-sage-500/20 dark:to-sage-500/10 border border-sage-200/50 dark:border-sage-500/20">
              <CalendarRange className="w-5 h-5 text-sage-600 dark:text-sage-400" />
            </div>
            <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 uppercase tracking-widest">
              {t("kicker")}
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground max-w-lg leading-relaxed">
            {t("description")}
          </p>
        </div>

        {result.error !== null || !result.data.hasActivePlan ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4 animate-fade-up">
            <CalendarPlus className="w-10 h-10 mx-auto text-muted-foreground" />
            <h2 className="font-display font-bold text-xl">{t("empty.title")}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">{t("empty.body")}</p>
            <Link
              href="/meal-plans"
              className="inline-flex items-center rounded-full bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 text-sm font-medium transition-colors"
            >
              {t("empty.cta")}
            </Link>
          </div>
        ) : (
          <MyWeekBoard initial={result.data} />
        )}

        <EducationalDisclaimer />
      </PageContainer>
    </div>
  );
}
