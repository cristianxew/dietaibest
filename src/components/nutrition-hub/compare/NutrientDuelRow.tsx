"use client";

import { Leaf, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NutrientDirection, NutrientUnit } from "@/lib/nutrients/registry";
import { formatNutrientAmount } from "@/components/nutrition-hub/format";

interface NutrientDuelRowProps {
  label: string;
  unit: NutrientUnit;
  direction: NutrientDirection;
  a?: number;
  b?: number;
  noDataLabel: string;
  delayMs?: number;
}

/**
 * One nutrient as mirrored bars growing outward from a center spine:
 * left = contender A (coral), right = contender B (gold). Missing data
 * renders an em-dash — never a zero-width "0" bar.
 */
export function NutrientDuelRow({
  label,
  unit,
  direction,
  a,
  b,
  noDataLabel,
  delayMs = 0,
}: NutrientDuelRowProps) {
  const max = Math.max(a ?? 0, b ?? 0) || 1;
  const bothKnown = a !== undefined && b !== undefined;
  // Winner = higher side, only when meaningfully apart (>2% of scale)
  const winner: "a" | "b" | null =
    bothKnown && Math.abs(a - b) > max * 0.02 ? (a > b ? "a" : "b") : null;

  const WinnerIcon =
    direction === "goal" ? Leaf : direction === "limit" ? TriangleAlert : null;

  const renderValue = (value: number | undefined, side: "a" | "b") => {
    if (value === undefined) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-xs text-muted-foreground/50 cursor-help">
              —
            </span>
          </TooltipTrigger>
          <TooltipContent>{noDataLabel}</TooltipContent>
        </Tooltip>
      );
    }
    const isWinner = winner === side;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-mono text-xs tabular-nums",
          isWinner ? "font-semibold text-foreground" : "text-muted-foreground"
        )}
      >
        {isWinner && WinnerIcon && (
          <WinnerIcon
            className={cn(
              "w-3 h-3",
              direction === "goal"
                ? "text-sage-500 dark:text-sage-400"
                : "text-gold-500 dark:text-gold-400"
            )}
          />
        )}
        {formatNutrientAmount(value, unit)}
      </span>
    );
  };

  return (
    <div
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 animate-fade-up"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {/* left side (A) — mirrored */}
      <div className="flex items-center justify-end gap-2 min-w-0">
        {renderValue(a, "a")}
        <div className="h-2.5 rounded-full bg-muted w-full max-w-44 overflow-hidden flex justify-end shrink">
          {a !== undefined && (
            <div
              className="h-full rounded-full bg-brand-500 dark:bg-brand-400 transition-[width] duration-700 ease-out"
              style={{ width: `${(a / max) * 100}%` }}
            />
          )}
        </div>
      </div>

      <span className="text-xs font-medium text-foreground text-center w-24 sm:w-28 shrink-0">
        {label}
      </span>

      {/* right side (B) */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="h-2.5 rounded-full bg-muted w-full max-w-44 overflow-hidden shrink">
          {b !== undefined && (
            <div
              className="h-full rounded-full bg-gold-500 dark:bg-gold-400 transition-[width] duration-700 ease-out"
              style={{ width: `${(b / max) * 100}%` }}
            />
          )}
        </div>
        {renderValue(b, "b")}
      </div>
    </div>
  );
}
