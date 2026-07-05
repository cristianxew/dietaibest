"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RdaEntry } from "@/lib/nutrients/rda";
import { formatNutrientAmount } from "@/components/nutrition-hub/format";

interface DayFillBarProps {
  label: string;
  entry: RdaEntry;
  /** Amount provided by the meal (undefined = unknown) */
  amount?: number;
  delayMs?: number;
}

/**
 * One nutrient as a "how much of your day" track. Goal nutrients fill
 * sage; limit nutrients fill gold and overflow coral past 100% of the
 * daily ceiling. Unknown amounts render an em-dash, never 0%.
 */
export function DayFillBar({ label, entry, amount, delayMs = 0 }: DayFillBarProps) {
  const t = useTranslations("nutritionHub.vsDay");

  const pct = amount !== undefined ? (amount / entry.value) * 100 : null;
  const isLimit = entry.direction === "limit";
  const over = pct !== null && pct > 100;
  const fillPct = pct === null ? 0 : Math.min(pct, 100);
  const personalized = entry.basis !== "fdaDv";

  return (
    <div
      className="grid grid-cols-[7rem_1fr_auto] sm:grid-cols-[9rem_1fr_auto] items-center gap-3 animate-fade-up"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className="text-xs font-medium text-foreground truncate">{label}</span>

      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        {pct !== null && (
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
              over
                ? "bg-brand-500 dark:bg-brand-400"
                : isLimit
                  ? "bg-gold-500 dark:bg-gold-400"
                  : "bg-sage-500 dark:bg-sage-400"
            )}
            style={{ width: `${fillPct}%` }}
          />
        )}
      </div>

      <div className="flex items-center gap-1.5 justify-end min-w-24">
        {pct === null ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground/50 cursor-help">—</span>
            </TooltipTrigger>
            <TooltipContent>{t("noData")}</TooltipContent>
          </Tooltip>
        ) : (
          <span
            className={cn(
              "font-mono text-xs tabular-nums",
              over && isLimit
                ? "font-semibold text-brand-600 dark:text-brand-400"
                : "text-muted-foreground"
            )}
          >
            {Math.round(pct)}%
            <span className="hidden sm:inline text-muted-foreground/60">
              {" · "}
              {amount !== undefined ? formatNutrientAmount(amount, entry.unit) : ""}
              {" / "}
              {formatNutrientAmount(entry.value, entry.unit)}
            </span>
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] cursor-help select-none text-muted-foreground/60">
              {personalized ? "✦" : "▢"}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {personalized ? t("basisPersonalized") : t("basisGeneric")}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
