"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FoodPortionOption } from "@/actions/nutrition-hub";

interface BasisToggleProps {
  portions: FoodPortionOption[];
  grams: number;
  onGramsChange: (grams: number) => void;
}

/**
 * Display-basis picker for a food contender: per 100 g (default) or any
 * USDA household portion. Recipes don't render this — they're always
 * per-serving with an explicit pill, keeping mixed comparisons honest.
 */
export function BasisToggle({ portions, grams, onGramsChange }: BasisToggleProps) {
  const t = useTranslations("nutritionHub.compare.basis");

  const value =
    grams === 100
      ? "per100g"
      : (portions.findIndex((p) => p.gramWeight === grams) ?? -1) >= 0
        ? `portion-${portions.findIndex((p) => p.gramWeight === grams)}`
        : "per100g";

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === "per100g") onGramsChange(100);
        else {
          const index = Number(v.replace("portion-", ""));
          const portion = portions[index];
          if (portion) onGramsChange(portion.gramWeight);
        }
      }}
    >
      <SelectTrigger size="sm" className="h-7 text-xs w-auto gap-1.5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="per100g">{t("per100g")}</SelectItem>
        {portions.map((portion, i) => (
          <SelectItem key={`${portion.label}-${i}`} value={`portion-${i}`}>
            {portion.label} · {Math.round(portion.gramWeight)} g
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
