"use client";

import { useTranslations } from "next-intl";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PickedItem } from "@/components/nutrition-hub/ItemSearchCombobox";

/** One-tap suggested matchups (well-known USDA SR Legacy foods). */
const SUGGESTED_MATCHUPS: Array<{
  key: "bananaApple" | "spinachBroccoli" | "avocadoBanana";
  a: PickedItem;
  b: PickedItem;
}> = [
  {
    key: "bananaApple",
    a: { ref: { type: "fdc", id: 173944 }, label: "Bananas, raw" },
    b: { ref: { type: "fdc", id: 171688 }, label: "Apples, raw, with skin" },
  },
  {
    key: "spinachBroccoli",
    a: { ref: { type: "fdc", id: 168462 }, label: "Spinach, raw" },
    b: { ref: { type: "fdc", id: 170379 }, label: "Broccoli, raw" },
  },
  {
    key: "avocadoBanana",
    a: { ref: { type: "fdc", id: 171705 }, label: "Avocados, raw" },
    b: { ref: { type: "fdc", id: 173944 }, label: "Bananas, raw" },
  },
];

interface CompareEmptyStateProps {
  onPick: (a: PickedItem, b: PickedItem) => void;
}

export function CompareEmptyState({ onPick }: CompareEmptyStateProps) {
  const t = useTranslations("nutritionHub.compare.empty");

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center">
      <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
        <Swords className="w-6 h-6 text-brand-600 dark:text-brand-400" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-xl font-bold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {t("description")}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap justify-center">
        {SUGGESTED_MATCHUPS.map(({ key, a, b }) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPick(a, b)}
          >
            {t(`suggestions.${key}`)}
          </Button>
        ))}
      </div>
    </div>
  );
}
