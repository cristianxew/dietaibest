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
      <div className="p-4 border-b border-border/40 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="font-display font-bold text-lg text-foreground">
          {t("nutrition", { fallback: "Nutrition Facts" })}
        </h3>
        <span className="text-[11px] font-medium text-muted-foreground">
          {t("nutritionPerServing", { fallback: "Per serving" })}
          {servings !== undefined && ` · ${servings} serving${servings !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Macro identity colours: the meal planner's Chip tint/text pairs
          (design_system.md → "Macro Display Colors"), AA in both themes. */}
      <div className="grid grid-cols-4 divide-x divide-border/40">
        <div className="flex flex-col items-center justify-center py-5 bg-brand-500/8 text-brand-700 dark:text-brand-600">
          <span className="font-bold text-xl sm:text-2xl tabular-nums">
            {displayCals.toFixed(0)}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
            {t("cal", { fallback: "Calories" })}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-5 bg-slate-500/10 text-slate-600 dark:text-slate-400">
          <span className="font-bold text-xl sm:text-2xl tabular-nums">
            {protein.toFixed(0)}g
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
            {t("protein", { fallback: "Protein" })}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-5 bg-gold-500/10 text-gold-700 dark:text-gold-400">
          <span className="font-bold text-xl sm:text-2xl tabular-nums">
            {carbs.toFixed(0)}g
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
            {t("carbs", { fallback: "Carbs" })}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-5 bg-sage-500/10 text-sage-700 dark:text-sage-600">
          <span className="font-bold text-xl sm:text-2xl tabular-nums">
            {fat.toFixed(0)}g
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5">
            {t("fat", { fallback: "Fat" })}
          </span>
        </div>
      </div>

      {fiber && fiber > 0 && (
        <div className="p-5 border-t border-border/40 space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground w-24">Fiber</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              {/* Neutral: sage now belongs to fat, which sits right above. */}
              <div className="h-full bg-stone-500 dark:bg-stone-400 rounded-full" style={{ width: `${Math.min(100, (fiber / 30) * 100)}%` }} />
            </div>
            <span className="text-sm font-bold w-12 text-right">{fiber.toFixed(1)}g</span>
          </div>
        </div>
      )}
    </div>
  );
}
