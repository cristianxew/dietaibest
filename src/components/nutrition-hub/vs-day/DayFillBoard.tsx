"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChefHat, Loader2, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getItemProfiles,
  type ItemNutrientProfile,
  type MyRdaProfile,
} from "@/actions/nutrition-hub";
import { serializeItemRef } from "@/lib/nutrients/compare-url";
import { scaleVector, type NutrientVector } from "@/lib/nutrients/extract";
import {
  ALL_NUTRIENT_KEYS,
  NUTRIENT_REGISTRY,
  type NutrientGroup,
} from "@/lib/nutrients/registry";
import {
  ItemSearchCombobox,
  type PickedItem,
} from "@/components/nutrition-hub/ItemSearchCombobox";
import { foodShortName } from "@/components/nutrition-hub/format";
import { DayFillBar } from "./DayFillBar";
import { ProfileNudge } from "./ProfileNudge";
import { CoverageBadge } from "@/components/nutrition-hub/shared/CoverageBadge";
import { AskDietaiButton } from "@/components/nutrition-hub/shared/AskDietaiButton";

const GROUP_ORDER: Array<{ group: NutrientGroup[]; key: string }> = [
  { group: ["energy", "macro"], key: "energyMacros" },
  { group: ["fatProfile"], key: "watch" },
  { group: ["mineral", "vitamin"], key: "vitaminsMinerals" },
];

// sodium belongs to "watch" in this view even though it's a mineral
const WATCH_OVERRIDES = new Set(["sodium", "sugar", "satFat", "cholesterol"]);

function itemLabel(profile: ItemNutrientProfile): string {
  return profile.kind === "food"
    ? foodShortName(profile.description)
    : profile.title;
}

interface DayFillBoardProps {
  initialItem: ItemNutrientProfile | null;
  myRda: MyRdaProfile;
}

export function DayFillBoard({ initialItem, myRda }: DayFillBoardProps) {
  const t = useTranslations("nutritionHub.vsDay");
  const tNutrients = useTranslations("nutritionHub.nutrients");
  const tSeeds = useTranslations("chat.seeds.nutritionHub");
  const router = useRouter();

  const [item, setItem] = React.useState<ItemNutrientProfile | null>(initialItem);
  const [multiplier, setMultiplier] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  const selectItem = async (picked: PickedItem) => {
    setLoading(true);
    try {
      const result = await getItemProfiles({ items: [picked.ref] });
      if (result.error !== null || !result.data[0]) {
        toast.error(t("loadError"));
        return;
      }
      setItem(result.data[0]);
      setMultiplier(1);
      router.replace(
        `/nutrition/vs-day?item=${serializeItemRef(picked.ref)}`,
        { scroll: false }
      );
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setItem(null);
    router.replace("/nutrition/vs-day", { scroll: false });
  };

  const baseVector: NutrientVector | null = item
    ? item.kind === "food"
      ? item.per100g
      : item.perServing
    : null;
  const vector = baseVector ? scaleVector(baseVector, multiplier) : null;

  // Headline: protein when known, else calories
  const headlineKey =
    vector?.protein !== undefined ? "protein" : "kcal";
  const headlinePct =
    vector?.[headlineKey] !== undefined
      ? Math.round(
          ((vector[headlineKey] ?? 0) / myRda.rda.entries[headlineKey].value) * 100
        )
      : null;

  const sections = GROUP_ORDER.map(({ group, key }) => ({
    key,
    nutrients: ALL_NUTRIENT_KEYS.filter((nutrient) => {
      const inGroup = WATCH_OVERRIDES.has(nutrient)
        ? key === "watch"
        : group.includes(NUTRIENT_REGISTRY[nutrient].group) &&
          !WATCH_OVERRIDES.has(nutrient);
      return inGroup && vector?.[nutrient] !== undefined;
    }),
  })).filter((section) => section.nutrients.length > 0);

  let rowIndex = 0;

  return (
    <div className="space-y-6">
      {!myRda.profileComplete && <ProfileNudge />}

      {/* item slot */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        {loading ? (
          <div className="flex items-center justify-center min-h-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : !item ? (
          <>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("pickPrompt")}
            </span>
            <ItemSearchCombobox onSelect={selectItem} />
          </>
        ) : (
          <div className="flex items-center gap-3 flex-wrap">
            {item.kind === "recipe" &&
              (item.imageUrl ? (
                <Image
                  src={item.imageUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="rounded-xl object-cover w-11 h-11"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                  <ChefHat className="w-5 h-5 text-muted-foreground" />
                </div>
              ))}
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="font-display text-lg font-bold leading-tight line-clamp-1">
                {item.kind === "food" ? item.description : item.title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {item.kind === "food"
                    ? t("basisPer100g")
                    : t("basisPerServing")}
                </Badge>
                {item.kind === "recipe" && (
                  <CoverageBadge
                    coverage={item.coverage}
                    matched={item.matchedIngredients}
                    total={item.totalIngredients}
                  />
                )}
              </div>
            </div>

            {/* servings stepper */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={multiplier <= 1}
                onClick={() => setMultiplier((m) => Math.max(1, m - 1))}
                aria-label={t("decrease")}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="font-mono text-sm tabular-nums w-8 text-center">
                ×{multiplier}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
                disabled={multiplier >= 6}
                onClick={() => setMultiplier((m) => Math.min(6, m + 1))}
                aria-label={t("increase")}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            <button
              type="button"
              onClick={clear}
              className="p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
              aria-label={t("clear")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {item && vector && (
        <>
          {/* hero headline */}
          {headlinePct !== null && (
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-center animate-fade-up">
              {t.rich("headline", {
                pct: headlinePct,
                nutrient: tNutrients(`${headlineKey}.name`).toLowerCase(),
                highlight: (chunks) => (
                  <span className="text-sage-600 dark:text-sage-400">
                    {chunks}
                  </span>
                ),
              })}
            </h2>
          )}

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-6">
            {sections.map((section) => (
              <div key={section.key} className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  {t(`groups.${section.key}`)}
                </h4>
                {section.nutrients.map((nutrient) => {
                  rowIndex++;
                  return (
                    <DayFillBar
                      key={nutrient}
                      label={tNutrients(`${nutrient}.name`)}
                      entry={myRda.rda.entries[nutrient]}
                      amount={vector[nutrient]}
                      delayMs={Math.min(rowIndex * 40, 600)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <AskDietaiButton
              prompt={tSeeds("vsDay", {
                item: itemLabel(item),
                pct: headlinePct ?? 0,
                nutrient: tNutrients(`${headlineKey}.name`).toLowerCase(),
              })}
            />
          </div>
        </>
      )}
    </div>
  );
}
