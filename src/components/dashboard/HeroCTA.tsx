"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Target,
  ChefHat,
  Calendar,
  X,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import type { DashboardState } from "@/lib/dashboard-state";
import { useRecipeModal } from "@/hooks/use-recipe-modal";

const DISMISS_KEY = "DietAI_hero_cta_dismissed";

type NextStepState = Exclude<DashboardState, "fully_active">;

interface HeroCTAProps {
  dashboardState: DashboardState;
  recipeCount: number;
  mealPlanCount: number;
}

interface StepConfig {
  icon: LucideIcon;
  titleKey: string;
  hintKey?: string;
  hintCount?: number;
  ctaKey: string;
  /** Navigate to a page, or run an in-place action (e.g. open the recipe modal). */
  target: { href: string } | { onClick: () => void };
}

/**
 * Slim "next step" banner: one line with the step title, an optional
 * count hint, a single primary CTA, and a dismiss button.
 */
export function HeroCTA({
  dashboardState,
  recipeCount,
  mealPlanCount,
}: HeroCTAProps) {
  const t = useTranslations("dashboard.heroCTA");
  const { openCreate } = useRecipeModal();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(localStorage.getItem(DISMISS_KEY) !== "true");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setIsVisible(false);
  };

  if (!isVisible || dashboardState === "fully_active") {
    return null;
  }

  const steps: Record<NextStepState, StepConfig> = {
    onboarding_incomplete: {
      icon: Sparkles,
      titleKey: "onboardingIncomplete.title",
      ctaKey: "onboardingIncomplete.cta",
      target: { href: "/onboarding" },
    },
    needs_first_recipe: {
      icon: ChefHat,
      titleKey: "needsFirstRecipe.title",
      ctaKey: "needsFirstRecipe.createCTA",
      // The modal's entry screen already offers manual, AI, and import paths.
      target: { onClick: openCreate },
    },
    needs_meal_plan: {
      icon: Calendar,
      titleKey: "needsMealPlan.title",
      hintKey: "needsMealPlan.hint",
      hintCount: recipeCount,
      ctaKey: "needsMealPlan.cta",
      target: { href: "/meal-plans/new" },
    },
    needs_active_plan: {
      icon: Target,
      titleKey: "needsActivePlan.title",
      hintKey: "needsActivePlan.hint",
      hintCount: mealPlanCount,
      ctaKey: "needsActivePlan.cta",
      target: { href: "/meal-plans" },
    },
  };

  const step = steps[dashboardState];
  const Icon = step.icon;
  const ctaClass =
    "flex items-center gap-0.5 text-sm font-medium text-brand-600 hover:underline underline-offset-4";
  const ctaContent = (
    <>
      {t(step.ctaKey)}
      <ChevronRight className="h-4 w-4" />
    </>
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-brand-200/60 bg-brand-50/40 px-4 py-3 pr-12 sm:pr-3 relative">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-600">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-sm min-w-0">
          <span className="font-medium text-foreground">{t(step.titleKey)}</span>
          {step.hintKey && (
            <span className="text-muted-foreground">
              {" · "}
              {t(step.hintKey, { count: step.hintCount ?? 0 })}
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-3 sm:shrink-0 pl-11 sm:pl-0">
        {"href" in step.target ? (
          <Link href={step.target.href} className={ctaClass}>
            {ctaContent}
          </Link>
        ) : (
          <button type="button" onClick={step.target.onClick} className={ctaClass}>
            {ctaContent}
          </button>
        )}
        {/* 28px visually; the ::after hit slop makes it 44px on touch. */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 sm:relative sm:top-auto sm:right-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']"
          aria-label={t("dismiss")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
