import { getTranslations } from "next-intl/server";
import { CircleGauge } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { DayFillBoard } from "@/components/nutrition-hub/vs-day/DayFillBoard";
import { EducationalDisclaimer } from "@/components/nutrition-hub/shared/EducationalDisclaimer";
import { parseItemRef } from "@/lib/nutrients/compare-url";
import {
  getItemProfiles,
  getMyRdaProfile,
  type ItemNutrientProfile,
  type MyRdaProfile,
} from "@/actions/nutrition-hub";
import { computeRdaProfile } from "@/lib/nutrients/rda";

interface VsDayPageProps {
  searchParams: Promise<{ item?: string }>;
}

export default async function VsDayPage({ searchParams }: VsDayPageProps) {
  const t = await getTranslations("nutritionHub.vsDay");
  const { item } = await searchParams;

  const ref = parseItemRef(item);

  const [profileResult, itemResult] = await Promise.all([
    getMyRdaProfile(),
    ref ? getItemProfiles({ items: [ref] }) : Promise.resolve(null),
  ]);

  const myRda: MyRdaProfile =
    profileResult.error === null
      ? profileResult.data
      : { rda: computeRdaProfile({}), profileComplete: false };

  const initialItem: ItemNutrientProfile | null =
    itemResult && itemResult.error === null ? (itemResult.data[0] ?? null) : null;

  return (
    <div className="min-h-screen relative bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sage-100/30 dark:bg-sage-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-brand-100/20 dark:bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sage-100 to-sage-50 dark:from-sage-500/20 dark:to-sage-500/10 border border-sage-200/50 dark:border-sage-500/20">
              <CircleGauge className="w-5 h-5 text-sage-600 dark:text-sage-400" />
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

        <DayFillBoard initialItem={initialItem} myRda={myRda} />

        <EducationalDisclaimer />
      </PageContainer>
    </div>
  );
}
