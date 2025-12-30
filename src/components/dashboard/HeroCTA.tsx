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
  Utensils,
  Users,
  Link2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DashboardState } from "@/lib/dashboard-state";

const DISMISS_KEY = "DietAIbook_hero_cta_dismissed";

interface HeroCTAProps {
  dashboardState: DashboardState;
  recipeCount: number;
  mealPlanCount: number;
}

export function HeroCTA({
  dashboardState,
  recipeCount,
  mealPlanCount,
}: HeroCTAProps) {
  const t = useTranslations("dashboard.heroCTA");
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === "true") {
      setIsLoading(false);
      return;
    }

    if (dashboardState !== "fully_active") {
      setIsVisible(true);
    }
    setIsLoading(false);
  }, [dashboardState]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setIsVisible(false);
  };

  if (isLoading || !isVisible || dashboardState === "fully_active") {
    return null;
  }

  // Icon component based on state
  // const getStateIcon = () => {
  //   const iconClass = "h-6 w-6 text-white";
  //   switch (dashboardState) {
  //     case "onboarding_incomplete":
  //       return <Sparkles className={iconClass} />;
  //     case "needs_first_recipe":
  //       return <ChefHat className={iconClass} />;
  //     case "needs_meal_plan":
  //       return <Calendar className={iconClass} />;
  //     case "needs_active_plan":
  //       return <Target className={iconClass} />;
  //     default:
  //       return null;
  //   }
  // };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="relative border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors group"
          aria-label={t("dismiss")}
        >
          <X className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>

        <CardHeader className="pb-3">
          <div className="flex items-start gap-4 pr-10">
            {/* Icon badge */}
            {/* <div className="shrink-0 w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-brand-500/20">
              {getStateIcon()}
            </div> */}

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                {t("yourNextStep")}
              </p>
              <CardTitle className="text-xl md:text-2xl font-display font-semibold tracking-tight leading-tight text-foreground">
                {dashboardState === "onboarding_incomplete" &&
                  t("onboardingIncomplete.title")}
                {dashboardState === "needs_first_recipe" &&
                  t("needsFirstRecipe.title")}
                {dashboardState === "needs_meal_plan" &&
                  t("needsMealPlan.title")}
                {dashboardState === "needs_active_plan" &&
                  t("needsActivePlan.title")}
              </CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">
                {dashboardState === "onboarding_incomplete" &&
                  t("onboardingIncomplete.description")}
                {dashboardState === "needs_first_recipe" &&
                  t("needsFirstRecipe.description")}
                {dashboardState === "needs_meal_plan" &&
                  t("needsMealPlan.description")}
                {dashboardState === "needs_active_plan" &&
                  t("needsActivePlan.description")}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Onboarding Incomplete - Benefits Grid */}
          {dashboardState === "onboarding_incomplete" && (
            <>
              {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="group p-3 rounded-lg border border-stone-200/60 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-900/30 hover:bg-stone-100/50 dark:hover:bg-stone-800/40 transition-colors">
                  <Target className="h-4 w-4 text-brand-500 mb-1.5" />
                  <p className="text-xs font-medium text-foreground leading-snug">
                    {t("onboardingIncomplete.benefits.targets")}
                  </p>
                </div>
                <div className="group p-3 rounded-lg border border-stone-200/60 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-900/30 hover:bg-stone-100/50 dark:hover:bg-stone-800/40 transition-colors">
                  <Utensils className="h-4 w-4 text-gold-500 mb-1.5" />
                  <p className="text-xs font-medium text-foreground leading-snug">
                    {t("onboardingIncomplete.benefits.preferences")}
                  </p>
                </div>
                <div className="group p-3 rounded-lg border border-stone-200/60 dark:border-stone-800/60 bg-stone-50/50 dark:bg-stone-900/30 hover:bg-stone-100/50 dark:hover:bg-stone-800/40 transition-colors">
                  <Users className="h-4 w-4 text-sage-500 mb-1.5" />
                  <p className="text-xs font-medium text-foreground leading-snug">
                    {t("onboardingIncomplete.benefits.family")}
                  </p>
                </div>
              </div> */}
              <Button
                asChild
                size="default"
                className="w-full sm:w-auto shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <Link href="/onboarding" className="flex items-center gap-2">
                  {t("onboardingIncomplete.cta")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}

          {/* Needs First Recipe - Dual CTAs */}
          {dashboardState === "needs_first_recipe" && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  asChild
                  size="default"
                  className="flex-1 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
                >
                  <Link href="/recipes/new" className="flex items-center gap-2">
                    <ChefHat className="h-4 w-4" />
                    {t("needsFirstRecipe.createCTA")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="default"
                  variant="outline"
                  className="flex-1 hover:bg-muted transition-all"
                >
                  <Link href="/recipes/new?tab=url" className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    {t("needsFirstRecipe.importCTA")}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center sm:text-left">
                {t("needsFirstRecipe.hint")}
              </p>
            </div>
          )}

          {/* Needs Meal Plan */}
          {dashboardState === "needs_meal_plan" && (
            <div className="space-y-3">
              <Button
                asChild
                size="default"
                className="w-full sm:w-auto shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <Link href="/meal-plans/new" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t("needsMealPlan.cta")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("needsMealPlan.hint", { count: recipeCount })}
              </p>
            </div>
          )}

          {/* Needs Active Plan */}
          {dashboardState === "needs_active_plan" && (
            <div className="space-y-3">
              <Button
                asChild
                size="default"
                className="w-full sm:w-auto shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <Link href="/meal-plans" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {t("needsActivePlan.cta")}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("needsActivePlan.hint", { count: mealPlanCount })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
