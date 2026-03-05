"use client";

import { Link, Moon, ShoppingCart, Sun, Sunrise, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardPreviewProps {
  className?: string;
}

export function DashboardPreview({ className }: DashboardPreviewProps) {
  return (
    <div className={cn("relative pt-14 pb-10 px-4 lg:pt-16 lg:pb-12 lg:px-10", className)}>
      {/* ── Atmosphere blobs ── */}
      <div className="absolute top-0 left-0 w-56 h-56 rounded-full bg-brand-300/20 dark:bg-brand-500/10 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-gold-200/25 dark:bg-gold-500/[0.08] blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-52 h-52 rounded-full bg-sage-200/20 dark:bg-sage-500/[0.08] blur-3xl pointer-events-none" />

      {/* ── Back card — Imported Recipe (top-left, rotated) ── */}
      <div className="absolute top-0 left-0 z-10 w-52 lg:w-56 -rotate-3 animate-fade-up stagger-3">
        <div className="bg-card/90 dark:bg-card/80 backdrop-blur-sm rounded-xl border border-border p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-500/15">
              <Link className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wide">
              Imported recipe
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground mb-2">
            Spicy Tofu Bowl
          </p>
          <div className="flex gap-1.5 mb-2">
            <span className="text-[0.6rem] font-medium bg-brand-100 dark:bg-brand-500/15 text-brand-700 dark:text-brand-400 px-2 py-0.5 rounded-full">
              420 cal
            </span>
            <span className="text-[0.6rem] font-medium bg-sage-100 dark:bg-sage-500/15 text-sage-700 dark:text-sage-400 px-2 py-0.5 rounded-full">
              28g protein
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-violet-500" />
            <span className="text-[0.6rem] text-violet-600 dark:text-violet-400">
              AI adjusted to your targets
            </span>
          </div>
        </div>
      </div>

      {/* ── Main card — Today's Meals (center) ── */}
      <div className="relative z-20 animate-fade-up stagger-2">
        <div className="bg-card rounded-2xl border border-border shadow-2xl p-5 lg:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                Thursday
              </p>
              <h3 className="text-lg font-display font-semibold text-foreground leading-tight">
                Today&apos;s Meals
              </h3>
            </div>
            <span className="text-[0.65rem] font-semibold bg-sage-100 dark:bg-sage-500/15 text-sage-700 dark:text-sage-400 px-2.5 py-1 rounded-full">
              On Track
            </span>
          </div>

          {/* Meal rows */}
          <div className="space-y-2.5 mb-4">
            {/* Breakfast */}
            <div className="flex items-center justify-between bg-muted/60 dark:bg-muted/40 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Sunrise className="w-4 h-4 text-gold-500" />
                <span className="text-sm font-medium text-foreground">
                  Greek Yogurt Parfait
                </span>
              </div>
              <div className="flex gap-2 text-[0.65rem] text-muted-foreground">
                <span>380 cal</span>
                <span className="text-muted-foreground/50">&middot;</span>
                <span>24g prot</span>
              </div>
            </div>

            {/* Lunch */}
            <div className="flex items-center justify-between bg-muted/60 dark:bg-muted/40 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Sun className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-medium text-foreground">
                  Mediterranean Bowl
                </span>
              </div>
              <div className="flex gap-2 text-[0.65rem] text-muted-foreground">
                <span>520 cal</span>
                <span className="text-muted-foreground/50">&middot;</span>
                <span>32g prot</span>
              </div>
            </div>

            {/* Dinner */}
            <div className="flex items-center justify-between bg-muted/60 dark:bg-muted/40 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <Moon className="w-4 h-4 text-sage-500" />
                <span className="text-sm font-medium text-foreground">
                  Herb-Crusted Salmon
                </span>
              </div>
              <div className="flex gap-2 text-[0.65rem] text-muted-foreground">
                <span>580 cal</span>
                <span className="text-muted-foreground/50">&middot;</span>
                <span>38g prot</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[0.65rem] font-medium text-muted-foreground">
                1,480 / 2,100 cal
              </span>
              <span className="text-[0.65rem] font-medium text-muted-foreground">
                70%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-500"
                style={{ width: "70%" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Floating nutrition badge (top-right) ── */}
      <div className="absolute top-2 right-6 lg:top-0 lg:right-8 z-30 animate-fade-up stagger-4">
        <div className="animate-gentle-float flex items-center gap-1.5 bg-gold-100 dark:bg-gold-500/15 text-gold-700 dark:text-gold-400 px-3 py-1.5 rounded-full shadow-md border border-gold-200 dark:border-gold-500/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[0.7rem] font-semibold whitespace-nowrap">
            94g protein today
          </span>
        </div>
      </div>

      {/* ── Shopping notification (bottom-right, rotated) ── */}
      <div className="absolute bottom-0 right-0 lg:bottom-1 lg:right-2 z-30 rotate-2 animate-fade-up stagger-5">
        <div className="animate-gentle-float [animation-delay:1s] bg-foreground text-background rounded-xl px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-background/20">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-medium">Shopping list ready</p>
              <p className="text-[0.6rem] text-background/60">
                23 items &middot; Whole Foods
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
