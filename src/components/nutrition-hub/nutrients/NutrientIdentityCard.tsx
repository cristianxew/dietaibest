import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Leaf, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EncyclopediaEntry } from "@/lib/nutrients/encyclopedia";
import type { RdaEntry } from "@/lib/nutrients/rda";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import { ENCYCLOPEDIA_ICONS } from "./icon-map";
import { formatNutrientAmount } from "@/components/nutrition-hub/format";

const ACCENT_HEADER: Record<EncyclopediaEntry["accent"], string> = {
  brand:
    "from-brand-100 via-brand-50 to-transparent dark:from-brand-500/25 dark:via-brand-500/10",
  sage: "from-sage-100 via-sage-50 to-transparent dark:from-sage-500/25 dark:via-sage-500/10",
  gold: "from-gold-100 via-gold-50 to-transparent dark:from-gold-500/25 dark:via-gold-500/10",
};

const ACCENT_ICON: Record<EncyclopediaEntry["accent"], string> = {
  brand: "text-brand-600 dark:text-brand-400",
  sage: "text-sage-600 dark:text-sage-400",
  gold: "text-gold-600 dark:text-gold-400",
};

interface NutrientIdentityCardProps {
  entry: EncyclopediaEntry;
  rdaEntry: RdaEntry;
  delayMs?: number;
}

/** Trading-card style tile for the encyclopedia index. */
export async function NutrientIdentityCard({
  entry,
  rdaEntry,
  delayMs = 0,
}: NutrientIdentityCardProps) {
  const t = await getTranslations("nutritionHub");
  const Icon = ENCYCLOPEDIA_ICONS[entry.icon] ?? Leaf;
  const direction = NUTRIENT_REGISTRY[entry.nutrient].direction;

  return (
    <Link
      href={`/nutrition/nutrients/${entry.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg animate-fade-up"
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div
        className={cn(
          "flex items-center justify-between bg-gradient-to-br px-5 pt-5 pb-4",
          ACCENT_HEADER[entry.accent]
        )}
      >
        <Icon
          className={cn(
            "w-7 h-7 transition-transform duration-300 group-hover:scale-110",
            ACCENT_ICON[entry.accent]
          )}
        />
        {direction === "limit" ? (
          <TriangleAlert className="w-3.5 h-3.5 text-gold-500/70" />
        ) : (
          <Leaf className="w-3.5 h-3.5 text-sage-500/70" />
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-5 pb-5">
        <h3 className="font-display text-lg font-bold tracking-tight">
          {t(`nutrients.${entry.nutrient}.name`)}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {t(`encyclopedia.${entry.slug}.tagline`)}
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 self-start rounded-full bg-muted px-2.5 py-1 font-mono text-xs tabular-nums text-foreground">
          {formatNutrientAmount(rdaEntry.value, rdaEntry.unit)}
          <span className="text-muted-foreground/70">
            {direction === "limit"
              ? t("encyclopedia.meta.dailyLimit")
              : t("encyclopedia.meta.dailyTarget")}
          </span>
        </span>
      </div>
    </Link>
  );
}
