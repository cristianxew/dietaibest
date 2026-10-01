import { getTranslations } from "next-intl/server";
import { PageContainer } from "@/components/ui/page-container";
import { SMART_SWAPS, SWAP_CATEGORIES } from "@/lib/nutrients/swaps-data";
import { SwapCard } from "@/components/nutrition-hub/swaps/SwapCard";
import { EducationalDisclaimer } from "@/components/nutrition-hub/shared/EducationalDisclaimer";

export default async function SwapsPage() {
  const t = await getTranslations("nutritionHub.swaps");

  const byCategory = SWAP_CATEGORIES.map((category) => ({
    category,
    swaps: SMART_SWAPS.filter((swap) => swap.category === category),
  })).filter((group) => group.swaps.length > 0);

  let cardIndex = 0;

  return (
    <div className="min-h-screen relative bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sage-100/30 dark:bg-sage-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-brand-100/20 dark:bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl lg:text-[2rem] font-display font-bold text-foreground tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground max-w-lg leading-relaxed">
            {t("description")}
          </p>
        </div>

        <div className="space-y-8">
          {byCategory.map(({ category, swaps }) => (
            <section key={category} className="space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {t(`categories.${category}`)}
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {swaps.map((swap) => (
                  <SwapCard
                    key={swap.id}
                    swap={swap}
                    delayMs={Math.min(cardIndex++ * 80, 500)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <EducationalDisclaimer />
      </PageContainer>
    </div>
  );
}
