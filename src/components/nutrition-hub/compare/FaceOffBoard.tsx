"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, ChefHat, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getItemProfiles,
  type ItemNutrientProfile,
  type ItemRef,
} from "@/actions/nutrition-hub";
import { serializeItemRef } from "@/lib/nutrients/compare-url";
import { scaleVector, type NutrientVector } from "@/lib/nutrients/extract";
import { computeInsights } from "@/lib/nutrients/insights";
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
import { NutrientDuelRow } from "./NutrientDuelRow";
import { InsightChips } from "./InsightChips";
import { BasisToggle } from "./BasisToggle";
import { CompareEmptyState } from "./CompareEmptyState";
import { CoverageBadge } from "@/components/nutrition-hub/shared/CoverageBadge";
import { AskDietaiButton } from "@/components/nutrition-hub/shared/AskDietaiButton";

interface SlotState {
  profile: ItemNutrientProfile;
  /** Foods only: display basis in grams (default 100) */
  grams: number;
}

type Side = "a" | "b";

const GROUP_ORDER: NutrientGroup[] = [
  "energy",
  "macro",
  "fatProfile",
  "mineral",
  "vitamin",
];

function profileRef(profile: ItemNutrientProfile): ItemRef {
  return profile.kind === "food"
    ? { type: "fdc", id: profile.fdcId }
    : { type: "recipe", id: profile.recipeId };
}

function profileLabel(profile: ItemNutrientProfile): string {
  return profile.kind === "food"
    ? foodShortName(profile.description)
    : profile.title;
}

function displayVector(slot: SlotState): NutrientVector {
  return slot.profile.kind === "food"
    ? scaleVector(slot.profile.per100g, slot.grams / 100)
    : slot.profile.perServing;
}

interface FaceOffBoardProps {
  initialA: ItemNutrientProfile | null;
  initialB: ItemNutrientProfile | null;
}

export function FaceOffBoard({ initialA, initialB }: FaceOffBoardProps) {
  const t = useTranslations("nutritionHub.compare");
  const tNutrients = useTranslations("nutritionHub.nutrients");
  const tSeeds = useTranslations("chat.seeds.nutritionHub");
  const router = useRouter();

  const [slots, setSlots] = React.useState<Record<Side, SlotState | null>>({
    a: initialA ? { profile: initialA, grams: 100 } : null,
    b: initialB ? { profile: initialB, grams: 100 } : null,
  });
  const [loading, setLoading] = React.useState<Record<Side, boolean>>({
    a: false,
    b: false,
  });

  // Latest slots for event handlers that update both sides in sequence
  // (e.g. suggested matchups picking A and B back-to-back).
  const slotsRef = React.useRef(slots);
  slotsRef.current = slots;

  const syncUrl = React.useCallback(
    (next: Record<Side, SlotState | null>) => {
      const params = new URLSearchParams();
      if (next.a) params.set("a", serializeItemRef(profileRef(next.a.profile)));
      if (next.b) params.set("b", serializeItemRef(profileRef(next.b.profile)));
      const query = params.toString();
      router.replace(`/nutrition/compare${query ? `?${query}` : ""}`, {
        scroll: false,
      });
    },
    [router]
  );

  const selectItem = React.useCallback(
    async (side: Side, item: PickedItem) => {
      setLoading((prev) => ({ ...prev, [side]: true }));
      try {
        const result = await getItemProfiles({ items: [item.ref] });
        if (result.error !== null || !result.data[0]) {
          toast.error(t("loadError"));
          return;
        }
        const next = {
          ...slotsRef.current,
          [side]: { profile: result.data[0], grams: 100 },
        };
        slotsRef.current = next;
        setSlots(next);
        syncUrl(next);
      } catch {
        toast.error(t("loadError"));
      } finally {
        setLoading((prev) => ({ ...prev, [side]: false }));
      }
    },
    [syncUrl, t]
  );

  const clearSide = (side: Side) => {
    const next = { ...slotsRef.current, [side]: null };
    slotsRef.current = next;
    setSlots(next);
    syncUrl(next);
  };

  const swapSides = () => {
    const next = { a: slotsRef.current.b, b: slotsRef.current.a };
    slotsRef.current = next;
    setSlots(next);
    syncUrl(next);
  };

  const setGrams = (side: Side, grams: number) => {
    setSlots((prev) => {
      const slot = prev[side];
      if (!slot) return prev;
      return { ...prev, [side]: { ...slot, grams } };
    });
  };

  const vectorA = slots.a ? displayVector(slots.a) : null;
  const vectorB = slots.b ? displayVector(slots.b) : null;

  const insights = React.useMemo(
    () => (vectorA && vectorB ? computeInsights(vectorA, vectorB) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(vectorA), JSON.stringify(vectorB)]
  );

  const bothPicked = Boolean(slots.a && slots.b);

  // Rows where at least one side knows the value, grouped in registry order
  let rowIndex = 0;
  const groups = GROUP_ORDER.map((group) => ({
    group,
    keys: ALL_NUTRIENT_KEYS.filter(
      (key) =>
        NUTRIENT_REGISTRY[key].group === group &&
        (vectorA?.[key] !== undefined || vectorB?.[key] !== undefined)
    ),
  })).filter((g) => g.keys.length > 0);

  const renderContender = (side: Side) => {
    const slot = slots[side];

    if (loading[side]) {
      return (
        <div className="flex items-center justify-center h-full min-h-28 rounded-2xl border border-border bg-card">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!slot) {
      return (
        <div className="flex flex-col justify-center gap-2 min-h-28 rounded-2xl border border-dashed border-border bg-card/50 p-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {side === "a" ? t("slotA") : t("slotB")}
          </span>
          <ItemSearchCombobox onSelect={(item) => selectItem(side, item)} />
        </div>
      );
    }

    const { profile } = slot;
    return (
      <div
        className={cn(
          "relative flex flex-col gap-2 min-h-28 rounded-2xl border bg-card p-4",
          side === "a"
            ? "border-brand-200/70 dark:border-brand-500/30"
            : "border-gold-200/70 dark:border-gold-500/30"
        )}
      >
        <button
          type="button"
          onClick={() => clearSide(side)}
          className="absolute top-2.5 right-2.5 p-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
          aria-label={t("clear")}
        >
          <X className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2.5">
          {profile.kind === "recipe" &&
            (profile.imageUrl ? (
              <Image
                src={profile.imageUrl}
                alt=""
                width={40}
                height={40}
                className="rounded-xl object-cover w-10 h-10"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <ChefHat className="w-5 h-5 text-muted-foreground" />
              </div>
            ))}
          <h3 className="font-display text-lg font-bold leading-tight line-clamp-2 pr-6">
            {profile.kind === "food" ? profile.description : profile.title}
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-auto">
          {profile.kind === "food" ? (
            <>
              <Badge variant="outline" className="text-xs">
                {profile.dataType}
              </Badge>
              <BasisToggle
                portions={profile.portions}
                grams={slot.grams}
                onGramsChange={(grams) => setGrams(side, grams)}
              />
            </>
          ) : (
            <>
              <Badge variant="outline" className="text-xs">
                {t("recipeBadge")}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {t("basis.perServing")}
              </Badge>
              <CoverageBadge
                coverage={profile.coverage}
                matched={profile.matchedIngredients}
                total={profile.totalIngredients}
              />
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Contenders — sticky compressed header on mobile */}
      <div className="max-sm:sticky max-sm:top-0 max-sm:z-20 max-sm:-mx-4 max-sm:px-4 max-sm:py-2 max-sm:bg-background/95 max-sm:backdrop-blur">
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-4">
          {renderContender("a")}
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={swapSides}
              disabled={!slots.a && !slots.b}
              className="rounded-full transition-transform duration-300 hover:rotate-180"
              aria-label={t("swapSides")}
            >
              <ArrowLeftRight className="w-4 h-4" />
            </Button>
          </div>
          {renderContender("b")}
        </div>
      </div>

      {bothPicked && (
        <>
          <InsightChips
            insights={insights}
            labelA={slots.a ? profileLabel(slots.a.profile) : ""}
            labelB={slots.b ? profileLabel(slots.b.profile) : ""}
          />

          <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-6">
            {groups.map(({ group, keys }) => (
              <div key={group} className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">
                  {t(`groups.${group}`)}
                </h4>
                {keys.map((key) => {
                  const def = NUTRIENT_REGISTRY[key];
                  rowIndex++;
                  return (
                    <NutrientDuelRow
                      key={key}
                      label={tNutrients(`${key}.name`)}
                      unit={def.unit}
                      direction={def.direction}
                      a={vectorA?.[key]}
                      b={vectorB?.[key]}
                      noDataLabel={t("noData")}
                      delayMs={Math.min(rowIndex * 40, 600)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex justify-center">
            <AskDietaiButton
              prompt={tSeeds("compare", {
                a: slots.a ? profileLabel(slots.a.profile) : "",
                b: slots.b ? profileLabel(slots.b.profile) : "",
              })}
            />
          </div>
        </>
      )}

      {!slots.a && !slots.b && (
        <CompareEmptyState
          onPick={(refA, refB) => {
            selectItem("a", refA);
            selectItem("b", refB);
          }}
        />
      )}
    </div>
  );
}
