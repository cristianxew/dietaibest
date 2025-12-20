"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, ChefHat, Calendar, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GettingStartedSectionProps {
  profileComplete: boolean;
  hasRecipes: boolean;
  hasMealPlans: boolean;
}

export function GettingStartedSection({
  profileComplete,
  hasRecipes,
  hasMealPlans,
}: GettingStartedSectionProps) {
  const t = useTranslations("dashboard.gettingStarted");

  const steps = [
    {
      id: 1,
      title: t("step1.title"),
      description: t("step1.description"),
      cta: t("step1.cta"),
      completedText: t("step1.completed"),
      href: "/profile",
      icon: User,
      completed: profileComplete,
      color: "blue",
    },
    {
      id: 2,
      title: t("step2.title"),
      description: t("step2.description"),
      cta: t("step2.cta"),
      completedText: t("step2.completed"),
      href: "/recipes/new",
      icon: ChefHat,
      completed: hasRecipes,
      color: "brand",
    },
    {
      id: 3,
      title: t("step3.title"),
      description: t("step3.description"),
      cta: t("step3.cta"),
      completedText: t("step3.completed"),
      href: "/meal-plans/new",
      icon: Calendar,
      completed: hasMealPlans,
      color: "sage",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  // Don't show if all steps are complete
  if (allComplete) {
    return null;
  }

  const getColorClasses = (color: string, completed: boolean) => {
    if (completed) {
      return {
        bg: "bg-sage-100 dark:bg-sage-900/30",
        icon: "text-sage-600 dark:text-sage-400",
        ring: "ring-sage-500",
      };
    }

    const colors: Record<string, { bg: string; icon: string; ring: string }> = {
      blue: {
        bg: "bg-blue-100 dark:bg-blue-900/30",
        icon: "text-blue-600 dark:text-blue-400",
        ring: "ring-blue-500",
      },
      brand: {
        bg: "bg-brand-100 dark:bg-brand-900/30",
        icon: "text-brand-600 dark:text-brand-400",
        ring: "ring-brand-500",
      },
      sage: {
        bg: "bg-sage-100 dark:bg-sage-900/30",
        icon: "text-sage-600 dark:text-sage-400",
        ring: "ring-sage-500",
      },
    };
    return colors[color] || colors.brand;
  };

  return (
    <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm overflow-hidden">
      {/* Progress bar at top */}
      <div className="h-1 bg-stone-100 dark:bg-stone-800">
        <div
          className="h-full bg-gradient-to-r from-brand-500 via-gold-400 to-sage-500 transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-display font-semibold tracking-tight">
            {t("title")}
          </CardTitle>
          <span className="text-xs text-muted-foreground font-mono">
            {completedCount}/{steps.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const colors = getColorClasses(step.color, step.completed);

            return (
              <div
                key={step.id}
                className={cn(
                  "relative p-4 rounded-xl transition-all duration-300",
                  step.completed
                    ? "bg-sage-50/50 dark:bg-sage-950/20"
                    : "bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-800"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Step number */}
                <div
                  className={cn(
                    "absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    step.completed
                      ? "bg-sage-500 text-white"
                      : "bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300"
                  )}
                >
                  {step.completed ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    step.id
                  )}
                </div>

                {/* Content */}
                <div className="space-y-3">
                  {/* Icon */}
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg)}>
                    <Icon className={cn("h-5 w-5", colors.icon)} />
                  </div>

                  {/* Text */}
                  <div className="space-y-1">
                    <h3
                      className={cn(
                        "font-medium text-sm",
                        step.completed
                          ? "text-sage-700 dark:text-sage-300"
                          : "text-foreground"
                      )}
                    >
                      {step.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {step.description}
                    </p>
                  </div>

                  {/* CTA */}
                  {step.completed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-sage-600 dark:text-sage-400">
                      <Check className="h-3 w-3" />
                      {step.completedText}
                    </span>
                  ) : (
                    <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                      <Link href={step.href} className="gap-1">
                        {step.cta}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
