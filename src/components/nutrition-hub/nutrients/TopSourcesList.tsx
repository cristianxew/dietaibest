import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { getFoodsCached } from "@/lib/fdcRepo";
import { extractNutrientVector } from "@/lib/nutrients/extract";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import type { EncyclopediaEntry } from "@/lib/nutrients/encyclopedia";
import {
  foodShortName,
  formatNutrientAmount,
} from "@/components/nutrition-hub/format";

interface TopSourcesListProps {
  entry: EncyclopediaEntry;
}

/**
 * Live per-100g amounts of this nutrient in the curated whole foods,
 * ranked, with mini bars normalized to the best source and a deep link
 * into the Face-Off — cross-module linking is what makes it a hub.
 */
export async function TopSourcesList({ entry }: TopSourcesListProps) {
  const t = await getTranslations("nutritionHub.encyclopedia.meta");
  const unit = NUTRIENT_REGISTRY[entry.nutrient].unit;

  let foods;
  try {
    foods = await getFoodsCached(entry.topSourceFdcIds, {
      profile: "extended",
    });
  } catch {
    return null;
  }

  const ranked = foods
    .map((food) => ({
      fdcId: food.fdcId,
      name: foodShortName(food.description),
      amount: extractNutrientVector(food)[entry.nutrient],
    }))
    .filter(
      (source): source is typeof source & { amount: number } =>
        source.amount !== undefined
    )
    .sort((x, y) => y.amount - x.amount);

  if (ranked.length === 0) return null;

  const best = ranked[0];

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("topSources")}
      </h2>
      <div className="space-y-2.5">
        {ranked.map((source, i) => (
          <div
            key={source.fdcId}
            className="grid grid-cols-[1fr_auto] sm:grid-cols-[10rem_1fr_auto_auto] items-center gap-3 animate-fade-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="text-sm font-medium truncate">{source.name}</span>
            <div className="hidden sm:block h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-sage-500 dark:bg-sage-400"
                style={{ width: `${(source.amount / best.amount) * 100}%` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-muted-foreground text-right">
              {formatNutrientAmount(source.amount, unit)}
            </span>
            {source.fdcId !== best.fdcId ? (
              <Link
                href={`/nutrition/compare?a=fdc:${source.fdcId}&b=fdc:${best.fdcId}`}
                className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
              >
                {t("compareCta")}
                <ArrowRight className="w-3 h-3" />
              </Link>
            ) : (
              <span className="hidden sm:block w-16" />
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70">{t("per100g")}</p>
    </div>
  );
}
