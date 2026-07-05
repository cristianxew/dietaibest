import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Leaf, Lightbulb, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page-container";
import { findEncyclopediaEntry } from "@/lib/nutrients/encyclopedia";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import { computeRdaProfile } from "@/lib/nutrients/rda";
import { getMyRdaProfile } from "@/actions/nutrition-hub";
import { ENCYCLOPEDIA_ICONS } from "@/components/nutrition-hub/nutrients/icon-map";
import { TopSourcesList } from "@/components/nutrition-hub/nutrients/TopSourcesList";
import { AskDietaiButton } from "@/components/nutrition-hub/shared/AskDietaiButton";
import { EducationalDisclaimer } from "@/components/nutrition-hub/shared/EducationalDisclaimer";
import { formatNutrientAmount } from "@/components/nutrition-hub/format";

const ACCENT_HEADER = {
  brand:
    "from-brand-100 via-brand-50 to-transparent dark:from-brand-500/25 dark:via-brand-500/10",
  sage: "from-sage-100 via-sage-50 to-transparent dark:from-sage-500/25 dark:via-sage-500/10",
  gold: "from-gold-100 via-gold-50 to-transparent dark:from-gold-500/25 dark:via-gold-500/10",
} as const;

const ACCENT_ICON = {
  brand: "text-brand-600 dark:text-brand-400",
  sage: "text-sage-600 dark:text-sage-400",
  gold: "text-gold-600 dark:text-gold-400",
} as const;

interface NutrientDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function NutrientDetailPage({
  params,
}: NutrientDetailPageProps) {
  const { slug } = await params;
  const entry = findEncyclopediaEntry(slug);
  if (!entry) notFound();

  const [t, tNutrients, tMeta, tSeeds, profileResult] = await Promise.all([
    getTranslations(`nutritionHub.encyclopedia.${entry.slug}`),
    getTranslations("nutritionHub.nutrients"),
    getTranslations("nutritionHub.encyclopedia.meta"),
    getTranslations("chat.seeds.nutritionHub"),
    getMyRdaProfile(),
  ]);

  const rda =
    profileResult.error === null
      ? profileResult.data.rda
      : computeRdaProfile({});
  const rdaEntry = rda.entries[entry.nutrient];
  const direction = NUTRIENT_REGISTRY[entry.nutrient].direction;
  const Icon = ENCYCLOPEDIA_ICONS[entry.icon] ?? Leaf;
  const name = tNutrients(`${entry.nutrient}.name`);
  const personalized = rdaEntry.basis !== "fdaDv";

  return (
    <div className="min-h-screen relative bg-background">
      <PageContainer className="space-y-8 max-w-3xl">
        <Link
          href="/nutrition/nutrients"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {tMeta("backToIndex")}
        </Link>

        {/* hero identity card */}
        <div className="overflow-hidden rounded-3xl border border-border bg-card animate-fade-up">
          <div
            className={cn(
              "flex items-start justify-between bg-gradient-to-br px-6 sm:px-8 pt-8 pb-6",
              ACCENT_HEADER[entry.accent]
            )}
          >
            <div className="space-y-2">
              <Icon className={cn("w-10 h-10", ACCENT_ICON[entry.accent])} />
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
                {name}
              </h1>
              <p className="text-muted-foreground max-w-md leading-relaxed">
                {t("tagline")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap px-6 sm:px-8 py-4 border-t border-border/60">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-mono text-sm tabular-nums">
              {formatNutrientAmount(rdaEntry.value, rdaEntry.unit)}
              <span className="text-muted-foreground text-xs">
                {direction === "limit"
                  ? tMeta("dailyLimit")
                  : tMeta("dailyTarget")}
                {personalized ? " ✦" : ""}
              </span>
            </span>
            {direction === "limit" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gold-50 dark:bg-gold-500/10 border border-gold-200 dark:border-gold-500/20 px-3 py-1.5 text-xs font-medium text-gold-700 dark:text-gold-300">
                <TriangleAlert className="w-3 h-3" />
                {tMeta("limitBadge")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-sage-50 dark:bg-sage-500/10 border border-sage-200 dark:border-sage-500/20 px-3 py-1.5 text-xs font-medium text-sage-700 dark:text-sage-300">
                <Leaf className="w-3 h-3" />
                {tMeta("goalBadge")}
              </span>
            )}
          </div>
        </div>

        {/* what it does / why you care */}
        <div
          className="grid sm:grid-cols-2 gap-6 animate-fade-up"
          style={{ animationDelay: "100ms" }}
        >
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {tMeta("whatItDoes")}
            </h2>
            <p className="text-sm leading-relaxed">{t("whatItDoes")}</p>
          </div>
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {tMeta("whyYouCare")}
            </h2>
            <p className="text-sm leading-relaxed">{t("whyYouCare")}</p>
          </div>
        </div>

        {/* deficiency signs (goal nutrients only) */}
        {direction !== "limit" && (
          <div
            className="space-y-2 animate-fade-up"
            style={{ animationDelay: "180ms" }}
          >
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {tMeta("deficiencySigns")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("deficiencySigns")}
            </p>
          </div>
        )}

        {/* fun fact */}
        <div
          className="flex gap-3 rounded-2xl border border-gold-200/60 dark:border-gold-500/20 bg-gold-50/50 dark:bg-gold-500/5 p-4 animate-fade-up"
          style={{ animationDelay: "260ms" }}
        >
          <Lightbulb className="w-4 h-4 text-gold-600 dark:text-gold-400 shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{t("funFact")}</p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: "340ms" }}>
          <TopSourcesList entry={entry} />
        </div>

        <div className="flex justify-center">
          <AskDietaiButton prompt={tSeeds("nutrient", { nutrient: name })} />
        </div>

        <EducationalDisclaimer />
      </PageContainer>
    </div>
  );
}
