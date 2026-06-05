"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ChefHat, CalendarDays, Plus } from "lucide-react";
import { MEAL_SLOT_META } from "@/lib/meal-slot-meta";

/* ── PlanSwitcherSkeleton ──────────────────────────────── */
export function PlanSwitcherSkeleton() {
  return (
    <div className="flex flex-wrap gap-2.5 items-stretch animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="min-w-[200px] px-4 py-3.5 bg-card border border-border rounded-xl flex flex-col justify-between"
        >
          <div className="mb-3">
            {/* Title Line */}
            <Skeleton className="h-4 w-28 bg-stone-200 dark:bg-slate-800" />
          </div>
          {/* Metadata Row */}
          <div className="flex gap-3 text-[11px] text-muted-foreground mb-2">
            <div className="flex items-center gap-1">
              <Skeleton className="w-3 h-3 rounded-full bg-stone-200 dark:bg-slate-800" />
              <Skeleton className="h-3 w-6 bg-stone-200 dark:bg-slate-800" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="w-3 h-3 rounded-full bg-stone-200 dark:bg-slate-800" />
              <Skeleton className="h-3 w-8 bg-stone-200 dark:bg-slate-800" />
            </div>
            <div className="flex items-center gap-1">
              <Skeleton className="w-3 h-3 rounded-full bg-stone-200 dark:bg-slate-800" />
              <Skeleton className="h-3 w-12 bg-stone-200 dark:bg-slate-800" />
            </div>
          </div>
        </div>
      ))}
      <div
        className={cn(
          "min-w-[140px] px-4 py-3.5",
          "flex flex-col items-center justify-center gap-1.5",
          "bg-transparent border-[1.5px] border-dashed border-border rounded-xl opacity-60"
        )}
      >
        <Plus className="w-[18px] h-[18px] text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">Create Plan</span>
      </div>
    </div>
  );
}

/* ── WeeklyMacroStripSkeleton ──────────────────────────── */
export function WeeklyMacroStripSkeleton() {
  return (
    <div
      className={cn(
        "grid gap-3.5 px-[18px] py-3.5 animate-pulse",
        "grid-cols-[1fr_repeat(4,minmax(120px,160px))]",
        "bg-card border border-border rounded-xl"
      )}
    >
      {/* Label block */}
      <div className="flex flex-col justify-center">
        <Skeleton className="h-3 w-24 bg-stone-200 dark:bg-slate-800 mb-1.5" />
        <Skeleton className="h-3 w-36 bg-stone-200 dark:bg-slate-800" />
      </div>

      {/* Metric cells */}
      {["Calories", "Protein", "Carbs", "Fat"].map((m) => (
        <div key={m} className="flex flex-col justify-center">
          <Skeleton className="h-2.5 w-12 bg-stone-200 dark:bg-slate-800 mb-1.5" />
          <div className="flex items-baseline gap-[5px] mb-[6px]">
            <Skeleton className="h-5 w-10 bg-stone-200 dark:bg-slate-800" />
            <Skeleton className="h-3 w-16 bg-stone-200 dark:bg-slate-800" />
          </div>
          <Skeleton className="h-1 w-full bg-stone-200 dark:bg-slate-800 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ── RecipeSidebarSkeleton ────────────────────────────── */
export function RecipeSidebarSkeleton({ dense = false }: { dense?: boolean }) {
  return (
    <div className="flex flex-col gap-2 pr-1 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            "flex gap-2.5 rounded-[10px] border border-border bg-card transition-all duration-150",
            dense ? "p-2" : "p-2.5"
          )}
        >
          {/* Thumbnail */}
          <Skeleton
            className={cn(
              "bg-stone-200 dark:bg-slate-800 flex-shrink-0",
              dense ? "w-10 h-10 rounded-lg" : "w-12 h-12 rounded-lg"
            )}
          />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* Title Line */}
            <Skeleton className="h-3.5 w-3/4 bg-stone-200 dark:bg-slate-800 mb-2" />
            <div className="flex gap-1.5 mt-[5px] flex-wrap items-center">
              <Skeleton className="h-4 w-12 bg-stone-200 dark:bg-slate-800 rounded" />
              <Skeleton className="h-4 w-10 bg-stone-200 dark:bg-slate-800 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── MealCellSkeleton ────────────────────────────────── */
export function MealCellSkeleton({ dense = false, compact = false }: { dense?: boolean; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed border-border/70 bg-card/40 text-center animate-pulse",
        compact ? "p-2.5 min-h-[64px]" : dense ? "p-2.5 min-h-[72px]" : "p-3.5 min-h-[88px]"
      )}
    >
      <Skeleton className="w-4 h-4 rounded-full bg-stone-200 dark:bg-slate-800" />
      <Skeleton className="h-2.5 w-16 bg-stone-200 dark:bg-slate-800" />
    </div>
  );
}

/* ── DayMacrosSkeleton ───────────────────────────────── */
export function DayMacrosSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1.5 animate-pulse", !compact && "min-w-[200px]")}>
      <div className="flex items-baseline gap-2">
        <Skeleton className={cn("bg-stone-200 dark:bg-slate-800", compact ? "h-4 w-10" : "h-5 w-14")} />
        <Skeleton className="h-3 w-12 bg-stone-200 dark:bg-slate-800" />
      </div>
      <Skeleton className="h-1 w-full bg-stone-200 dark:bg-slate-800 rounded-full" />
      <div className="flex gap-2.5 text-[10px] text-muted-foreground font-mono">
        <Skeleton className="h-3 w-10 bg-stone-200 dark:bg-slate-800" />
        <Skeleton className="h-3 w-10 bg-stone-200 dark:bg-slate-800" />
        <Skeleton className="h-3 w-10 bg-stone-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

/* ── GridLayoutSkeleton ──────────────────────────────── */
export function GridLayoutSkeleton({ density }: { density: "regular" | "compact" }) {
  const dense = density === "compact";
  const numDays = 7;
  const cellMin = dense ? "minmax(110px, 1fr)" : "minmax(132px, 1fr)";
  const gridCols = `72px repeat(${numDays}, ${cellMin})`;

  const slots = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

  return (
    <div className="flex flex-col animate-pulse">
      {/* Day headers */}
      <div className="grid gap-2 mb-2.5 pb-1.5" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {Array.from({ length: numDays }).map((_, idx) => (
          <div key={idx} className="text-center py-1.5 px-1 flex flex-col items-center">
            <Skeleton className="h-2 w-8 bg-stone-200 dark:bg-slate-800 mb-1" />
            <Skeleton className="h-5 w-6 bg-stone-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      {/* Meal rows */}
      {slots.map((slot) => {
        const meta = MEAL_SLOT_META[slot as keyof typeof MEAL_SLOT_META] || { iconName: "Sparkles", colorClass: "text-brand-500", i18nKey: "slots.breakfast" };
        return (
          <div key={slot} className="grid gap-2 mb-2.5" style={{ gridTemplateColumns: gridCols }}>
            {/* Row label */}
            <div className="flex flex-col items-start justify-center pt-1.5">
              <Skeleton className="w-6 h-6 rounded-md bg-stone-200 dark:bg-slate-800" />
              <Skeleton className="h-3 w-12 bg-stone-200 dark:bg-slate-800 mt-1.5" />
            </div>
            {/* Cells */}
            {Array.from({ length: numDays }).map((_, dayIdx) => (
              <MealCellSkeleton key={dayIdx} dense={dense} />
            ))}
          </div>
        );
      })}

      {/* Macro footer */}
      <div className="grid gap-2 mt-2 pt-3.5 border-t border-border" style={{ gridTemplateColumns: gridCols }}>
        <div className="text-[10px] font-bold tracking-widest uppercase text-stone-400 self-center">
          TOTAL
        </div>
        {Array.from({ length: numDays }).map((_, dayIdx) => (
          <div key={dayIdx} className="py-1 px-1.5">
            <DayMacrosSkeleton compact />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── StackLayoutSkeleton ─────────────────────────────── */
export function StackLayoutSkeleton({ density }: { density: "regular" | "compact" }) {
  const dense = density === "compact";
  const slots = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

  return (
    <div className="flex flex-col gap-3.5 animate-pulse">
      {[1, 2, 3].map((dayNum) => (
        <div key={dayNum} className="bg-card border border-border rounded-[14px] p-[18px]">
          <div className="flex items-start justify-between mb-3.5 gap-4">
            <div className="flex items-baseline gap-3">
              <Skeleton className="h-6 w-20 bg-stone-200 dark:bg-slate-800" />
            </div>
            <DayMacrosSkeleton compact />
          </div>
          <div className="grid gap-2.5 grid-cols-4">
            {slots.map((slot) => (
              <div key={slot}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Skeleton className="w-3.5 h-3.5 rounded-full bg-stone-200 dark:bg-slate-800" />
                  <Skeleton className="h-2.5 w-12 bg-stone-200 dark:bg-slate-800" />
                </div>
                <MealCellSkeleton dense={dense} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── SplitLayoutSkeleton ─────────────────────────────── */
export function SplitLayoutSkeleton({ density }: { density: "regular" | "compact" }) {
  const dense = density === "compact";
  const slots = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

  return (
    <div className="grid gap-[18px] items-start animate-pulse" style={{ gridTemplateColumns: "200px 1fr" }}>
      {/* Day rail */}
      <div className="flex flex-col gap-1.5">
        {[1, 2, 3, 4, 5].map((dayNum) => (
          <div
            key={dayNum}
            className="w-full text-left px-3 py-2.5 rounded-[10px] bg-transparent border border-border flex flex-col gap-1.5"
          >
            <Skeleton className="h-4 w-12 bg-stone-200 dark:bg-slate-800" />
            <Skeleton className="h-3 w-16 bg-stone-200 dark:bg-slate-800" />
            <Skeleton className="h-1 w-full bg-stone-200 dark:bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>

      {/* Day editor pane */}
      <div className="bg-card border border-border rounded-[14px] p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <Skeleton className="h-3 w-24 bg-stone-200 dark:bg-slate-800 mb-1" />
            <Skeleton className="h-6 w-32 bg-stone-200 dark:bg-slate-800" />
          </div>
        </div>
        <div className="mb-5">
          <DayMacrosSkeleton />
        </div>
        <div className="grid gap-3 grid-cols-4">
          {slots.map((slot) => (
            <div key={slot}>
              <div className="flex items-center gap-1.5 mb-2">
                <Skeleton className="w-3.5 h-3.5 rounded bg-stone-200 dark:bg-slate-800" />
                <Skeleton className="h-2.5 w-12 bg-stone-200 dark:bg-slate-800" />
              </div>
              <MealCellSkeleton dense={dense} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
