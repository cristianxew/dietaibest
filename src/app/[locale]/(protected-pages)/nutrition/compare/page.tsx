import { getTranslations } from "next-intl/server";
import { Swords } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { FaceOffBoard } from "@/components/nutrition-hub/compare/FaceOffBoard";
import { EducationalDisclaimer } from "@/components/nutrition-hub/shared/EducationalDisclaimer";
import { parseItemRef } from "@/lib/nutrients/compare-url";
import {
  getItemProfiles,
  type ItemNutrientProfile,
} from "@/actions/nutrition-hub";

interface ComparePageProps {
  searchParams: Promise<{ a?: string; b?: string }>;
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const t = await getTranslations("nutritionHub.compare");
  const { a, b } = await searchParams;

  // Resolve shareable URL params server-side so the first paint is complete
  const refA = parseItemRef(a);
  const refB = parseItemRef(b);

  let initialA: ItemNutrientProfile | null = null;
  let initialB: ItemNutrientProfile | null = null;

  const refs = [refA, refB].filter((ref) => ref !== null);
  if (refs.length > 0) {
    const result = await getItemProfiles({ items: refs });
    if (result.error === null) {
      let index = 0;
      if (refA) initialA = result.data[index++] ?? null;
      if (refB) initialB = result.data[index] ?? null;
    }
  }

  return (
    <div className="min-h-screen relative bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
              <Swords className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
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

        <FaceOffBoard initialA={initialA} initialB={initialB} />

        <EducationalDisclaimer />
      </PageContainer>
    </div>
  );
}
