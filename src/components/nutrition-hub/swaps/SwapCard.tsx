import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, MoveRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFoodsCached } from "@/lib/fdcRepo";
import { extractNutrientVector } from "@/lib/nutrients/extract";
import {
  computeInsights,
  DEFAULT_INSIGHT_RULES,
  type Insight,
} from "@/lib/nutrients/insights";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import type { SmartSwap } from "@/lib/nutrients/swaps-data";
import {
  displayUnit,
  foodShortName,
} from "@/components/nutrition-hub/format";

interface SwapCardProps {
  swap: SmartSwap;
  delayMs?: number;
}

/** Delta chip text for the "to" side, derived from a from-vs-to insight. */
function chipFor(
  insight: Insight,
  t: Awaited<ReturnType<typeof getTranslations<"nutritionHub.swaps">>>,
  nutrientName: string
): { text: string; positive: boolean } | null {
  const unit = displayUnit(NUTRIENT_REGISTRY[insight.nutrient].unit);

  // "to" side (b) wins a goal nutrient → a gain worth bragging about
  if (insight.winner === "b" && insight.sentiment === "positive") {
    if (insight.kind === "onlyOneHas")
      return { text: t("chips.onlyHas", { nutrient: nutrientName }), positive: true };
    if (insight.kind === "timesMore")
      return {
        text: t("chips.timesMore", { times: insight.times ?? 0, nutrient: nutrientName }),
        positive: true,
      };
    return {
      text: t("chips.moreBy", { diff: insight.diff ?? 0, unit, nutrient: nutrientName }),
      positive: true,
    };
  }

  // "from" side (a) carries more of a limit nutrient → the swap avoids it
  if (insight.winner === "a" && insight.sentiment === "caution") {
    if (insight.kind === "onlyOneHas" || insight.kind === "timesMore")
      return {
        text: t("chips.timesLess", { times: insight.times ?? 0, nutrient: nutrientName }),
        positive: true,
      };
    return {
      text: t("chips.lessBy", { diff: insight.diff ?? 0, unit, nutrient: nutrientName }),
      positive: true,
    };
  }

  return null;
}

export async function SwapCard({ swap, delayMs = 0 }: SwapCardProps) {
  const [t, tNutrients] = await Promise.all([
    getTranslations("nutritionHub.swaps"),
    getTranslations("nutritionHub.nutrients"),
  ]);

  let fromFood, toFood;
  try {
    const foods = await getFoodsCached([swap.fromFdcId, swap.toFdcId], {
      profile: "extended",
    });
    fromFood = foods.find((f) => f.fdcId === swap.fromFdcId);
    toFood = foods.find((f) => f.fdcId === swap.toFdcId);
  } catch {
    return null;
  }
  if (!fromFood || !toFood) return null;

  // Swaps tell a ratio story across a typical serving, so the absolute
  // floors (tuned for raw per-100g face-offs) are relaxed — a 4× fiber
  // win between cooked grains is real even at small gram counts.
  const SWAP_MIN_DIFF: Record<string, number> = {
    kcal: 20,
    g: 0.5,
    mg: 10,
    ug: 1,
  };
  const rules = DEFAULT_INSIGHT_RULES.filter((rule) =>
    swap.headlineNutrients.includes(rule.nutrient)
  ).map((rule) => ({
    ...rule,
    minAbsDiff: Math.min(
      rule.minAbsDiff,
      SWAP_MIN_DIFF[NUTRIENT_REGISTRY[rule.nutrient].unit] ?? rule.minAbsDiff
    ),
  }));
  const insights = computeInsights(
    extractNutrientVector(fromFood),
    extractNutrientVector(toFood),
    rules
  );

  const chips = insights
    .map((insight) =>
      chipFor(insight, t, tNutrients(`${insight.nutrient}.name`))
    )
    .filter((chip): chip is NonNullable<typeof chip> => chip !== null)
    .slice(0, 3);

  if (chips.length === 0) return null; // a swap with no demonstrable win is no swap

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 animate-fade-up"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("insteadOf")}
          </span>
          <p className="font-display font-bold leading-tight text-muted-foreground">
            {foodShortName(fromFood.description)}
          </p>
        </div>
        <MoveRight className="w-5 h-5 text-sage-500 shrink-0" />
        <div className="flex-1 rounded-xl border-2 border-sage-300/60 dark:border-sage-500/40 bg-sage-50/50 dark:bg-sage-500/10 px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-sage-600 dark:text-sage-400">
            {t("try")}
          </span>
          <p className="font-display font-bold leading-tight">
            {foodShortName(toFood.description)}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {chips.map((chip) => (
          <span
            key={chip.text}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
              "bg-sage-50 text-sage-700 border-sage-200 dark:bg-sage-500/10 dark:text-sage-300 dark:border-sage-500/20"
            )}
          >
            {chip.text}
          </span>
        ))}
      </div>

      <Link
        href={`/nutrition/compare?a=fdc:${swap.fromFdcId}&b=fdc:${swap.toFdcId}`}
        className="inline-flex items-center gap-1 self-start text-sm font-medium text-brand-600 dark:text-brand-400 hover:underline"
      >
        {t("faceoffCta")}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
