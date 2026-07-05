import { getTranslations } from "next-intl/server";
import { BookOpenText } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { ENCYCLOPEDIA } from "@/lib/nutrients/encyclopedia";
import { computeRdaProfile } from "@/lib/nutrients/rda";
import { getMyRdaProfile } from "@/actions/nutrition-hub";
import { NutrientIdentityCard } from "@/components/nutrition-hub/nutrients/NutrientIdentityCard";
import { EducationalDisclaimer } from "@/components/nutrition-hub/shared/EducationalDisclaimer";

export default async function NutrientsIndexPage() {
  const t = await getTranslations("nutritionHub.encyclopedia.meta");

  const profileResult = await getMyRdaProfile();
  const rda =
    profileResult.error === null
      ? profileResult.data.rda
      : computeRdaProfile({});

  return (
    <div className="min-h-screen relative bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gold-100/30 dark:bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-brand-100/20 dark:bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-gold-100 to-gold-50 dark:from-gold-500/20 dark:to-gold-500/10 border border-gold-200/50 dark:border-gold-500/20">
              <BookOpenText className="w-5 h-5 text-gold-600 dark:text-gold-400" />
            </div>
            <span className="text-xs font-semibold text-gold-600 dark:text-gold-400 uppercase tracking-widest">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ENCYCLOPEDIA.map((entry, i) => (
            <NutrientIdentityCard
              key={entry.slug}
              entry={entry}
              rdaEntry={rda.entries[entry.nutrient]}
              delayMs={Math.min(i * 60, 600)}
            />
          ))}
        </div>

        <EducationalDisclaimer />
      </PageContainer>
    </div>
  );
}
