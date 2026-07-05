import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Swords } from "lucide-react";
import { getFoodsCached } from "@/lib/fdcRepo";
import { extractNutrientVector } from "@/lib/nutrients/extract";
import { NUTRIENT_REGISTRY, type NutrientKey } from "@/lib/nutrients/registry";
import { SMART_SWAPS } from "@/lib/nutrients/swaps-data";
import { foodShortName } from "@/components/nutrition-hub/format";
import { cn } from "@/lib/utils";

/** Daily-rotating pair sourced from the Smart Swaps dataset. */
const FEATURED_PAIRS: Array<{
  a: number;
  b: number;
  nutrients: NutrientKey[];
}> = SMART_SWAPS.map((swap) => ({
  a: swap.fromFdcId,
  b: swap.toFdcId,
  nutrients: swap.headlineNutrients,
}));

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function formatAmount(value: number, unit: string): string {
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${unit === "ug" ? "µg" : unit}`;
}

export async function FeaturedFaceOff() {
  const t = await getTranslations("nutritionHub");

  const pair = FEATURED_PAIRS[dayOfYear(new Date()) % FEATURED_PAIRS.length];

  let foodA, foodB;
  try {
    const foods = await getFoodsCached([pair.a, pair.b], {
      profile: "extended",
    });
    foodA = foods.find((f) => f.fdcId === pair.a);
    foodB = foods.find((f) => f.fdcId === pair.b);
  } catch {
    return null; // FDC unavailable — landing renders without the teaser
  }
  if (!foodA || !foodB) return null;

  const vectorA = extractNutrientVector(foodA);
  const vectorB = extractNutrientVector(foodB);

  const rows = pair.nutrients
    .map((key) => ({
      key,
      def: NUTRIENT_REGISTRY[key],
      a: vectorA[key],
      b: vectorB[key],
    }))
    .filter((row) => row.a !== undefined || row.b !== undefined);

  if (rows.length === 0) return null;

  return (
    <Link
      href={`/nutrition/compare?a=fdc:${pair.a}&b=fdc:${pair.b}`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-8",
        "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-brand-300/70 dark:hover:border-brand-500/40"
      )}
    >
      {/* warm corner glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-brand-100/40 dark:bg-brand-500/10 blur-3xl pointer-events-none" />

      <div className="relative space-y-6">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
            {t("hub.faceoff.kicker")}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {foodShortName(foodA.description)}
            <span className="mx-3 text-base font-sans font-semibold text-muted-foreground uppercase">
              {t("hub.faceoff.vs")}
            </span>
            {foodShortName(foodB.description)}
          </h2>
        </div>

        {/* mini duel rows */}
        <div className="space-y-3">
          {rows.map(({ key, def, a, b }) => {
            const max = Math.max(a ?? 0, b ?? 0) || 1;
            return (
              <div
                key={key}
                className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
              >
                <div className="flex items-center justify-end gap-2">
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {a !== undefined ? formatAmount(a, def.unit) : "—"}
                  </span>
                  <div className="h-2 rounded-full bg-muted w-full max-w-32 overflow-hidden flex justify-end">
                    <div
                      className="h-full rounded-full bg-brand-500 dark:bg-brand-400"
                      style={{ width: `${((a ?? 0) / max) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs font-medium text-foreground text-center min-w-20">
                  {t(`nutrients.${key}.name`)}
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full bg-muted w-full max-w-32 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gold-500 dark:bg-gold-400"
                      style={{ width: `${((b ?? 0) / max) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {b !== undefined ? formatAmount(b, def.unit) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400">
          {t("hub.faceoff.cta")}
          <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
        </div>
      </div>
    </Link>
  );
}
