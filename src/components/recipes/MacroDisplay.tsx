"use client";

import { useTranslations } from "next-intl";

interface MacroDisplayProps {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  servings?: number;
}

export function MacroDisplay({
  calories,
  protein,
  carbs,
  fat,
  fiber,
  servings,
}: MacroDisplayProps) {
  const t = useTranslations("recipes");

  if (
    calories === undefined ||
    calories === null ||
    !protein ||
    !carbs ||
    !fat
  ) {
    return null;
  }

  const displayCals = calories || ((protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9);

  return (
    <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        <h3 className="font-display font-bold text-lg text-foreground">
          {t("nutrition", { fallback: "Nutrition Facts" })}
        </h3>
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("nutritionPerServing", { fallback: "Per serving" })}
          {servings !== undefined && ` · ${servings} serving${servings !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div className="grid grid-cols-4 divide-x divide-border/40">
        <div className="flex flex-col items-center justify-center py-5 bg-brand-50/40 dark:bg-brand-900/10">
          <span className="font-bold text-2xl text-brand-600 dark:text-brand-400">
            {displayCals.toFixed(0)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-600/70 dark:text-brand-400/70 mt-0.5">
            {t("cal", { fallback: "Calories" })}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-5 bg-sage-50/40 dark:bg-sage-900/10">
          <span className="font-bold text-2xl text-sage-600 dark:text-sage-400">
            {protein.toFixed(0)}g
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-sage-600/70 dark:text-sage-400/70 mt-0.5">
            {t("protein", { fallback: "Protein" })}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-5 bg-gold-50/40 dark:bg-gold-900/10">
          <span className="font-bold text-2xl text-gold-600 dark:text-gold-400">
            {carbs.toFixed(0)}g
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-gold-600/70 dark:text-gold-400/70 mt-0.5">
            {t("carbs", { fallback: "Carbs" })}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-5 bg-stone-50 dark:bg-stone-900/20">
          <span className="font-bold text-2xl text-stone-600 dark:text-stone-400">
            {fat.toFixed(0)}g
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-stone-600/70 dark:text-stone-400/70 mt-0.5">
            {t("fat", { fallback: "Fat" })}
          </span>
        </div>
      </div>

      {fiber && fiber > 0 && (
        <div className="p-5 border-t border-border/40 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-24">Fiber</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-sage-500 rounded-full" style={{ width: `${Math.min(100, (fiber / 30) * 100)}%` }} />
            </div>
            <span className="text-sm font-bold w-12 text-right">{fiber.toFixed(1)}g</span>
          </div>
        </div>
      )}
    </div>
  );
}
