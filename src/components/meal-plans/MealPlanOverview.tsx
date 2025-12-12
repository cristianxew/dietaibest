"use client";

import { useRef, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChefHat,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import {
  CompactMealPlanCard,
  CompactMealPlanCardSkeleton,
} from "./CompactMealPlanCard";
import type { Prisma } from "@/generated/prisma";

type TemplateWithMealsAndSchedules = Prisma.MealPlanTemplateGetPayload<{
  include: {
    days: { include: { meals: { include: { recipe: true } } } };
    schedules: true;
  };
}>;

interface MealPlanOverviewProps {
  templates: TemplateWithMealsAndSchedules[];
  selectedId: string | null;
  onSelectPlan: (id: string) => void;
  onCreatePlan: () => void;
  onEditDetails: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyShareLink: (shareToken: string) => void;
  isPending: boolean;
}

export function MealPlanOverview({
  templates,
  selectedId,
  onSelectPlan,
  onCreatePlan,
  onEditDetails,
  onDuplicate,
  onDelete,
  onCopyShareLink,
  isPending,
}: MealPlanOverviewProps) {
  const t = useTranslations("mealPlans");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll position for navigation arrows
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );
  };

  useEffect(() => {
    checkScroll();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScroll);
      window.addEventListener("resize", checkScroll);
    }
    return () => {
      if (container) {
        container.removeEventListener("scroll", checkScroll);
      }
      window.removeEventListener("resize", checkScroll);
    };
  }, [templates]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 196; // Card width (180px) + gap (16px)
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  // Loading state
  if (isPending && templates.length === 0) {
    return (
      <div className="relative">
        <div className="flex gap-4 overflow-hidden pb-4 pt-1 px-1">
          {[...Array(4)].map((_, i) => (
            <CompactMealPlanCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (templates.length === 0) {
    return (
      <Card className="relative overflow-hidden border-2 border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-100/20 dark:bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative flex flex-col items-center justify-center text-center py-16 px-8">
          {/* Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20 flex items-center justify-center shadow-xl shadow-brand-500/10">
              <ChefHat className="w-10 h-10 text-brand-500" />
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold-400 flex items-center justify-center shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* Copy */}
          <div className="space-y-3 max-w-md">
            <h3 className="font-display font-bold text-2xl text-foreground">
              {t("noMealPlans")}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {t("noMealPlansDescription")}
            </p>
          </div>

          {/* CTA */}
          <Button
            onClick={onCreatePlan}
            className={cn(
              "mt-8 gap-2 h-12 px-8 shadow-lg shadow-brand-500/20",
              "bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700",
              "transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            )}
          >
            <Sparkles className="w-4 h-4" />
            {t("createFirstPlan")}
          </Button>

          {/* Features hint */}
          <div className="flex items-center gap-6 mt-8 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
              Drag & drop meals
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-sage-400" />
              Track macros
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-gold-400" />
              Schedule plans
            </span>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="relative group/overview">
      {/* Navigation Arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scroll("left")}
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2 z-20",
            "w-10 h-10 rounded-full",
            "bg-background/95 backdrop-blur-sm border border-border shadow-lg",
            "flex items-center justify-center",
            "opacity-0 group-hover/overview:opacity-100 transition-all duration-200",
            "hover:bg-brand-50 hover:border-brand-200 hover:scale-110",
            "dark:hover:bg-brand-500/10 dark:hover:border-brand-500/30",
            "-translate-x-2"
          )}
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
      )}

      {canScrollRight && (
        <button
          onClick={() => scroll("right")}
          className={cn(
            "absolute right-0 top-1/2 -translate-y-1/2 z-20",
            "w-10 h-10 rounded-full",
            "bg-background/95 backdrop-blur-sm border border-border shadow-lg",
            "flex items-center justify-center",
            "opacity-0 group-hover/overview:opacity-100 transition-all duration-200",
            "hover:bg-brand-50 hover:border-brand-200 hover:scale-110",
            "dark:hover:bg-brand-500/10 dark:hover:border-brand-500/30",
            "translate-x-2"
          )}
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      )}

      {/* Fade gradient indicators */}
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-0 bottom-4 w-12 z-10",
          "bg-gradient-to-r from-background to-transparent",
          "transition-opacity duration-200",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 bottom-4 w-12 z-10",
          "bg-gradient-to-l from-background to-transparent",
          "transition-opacity duration-200",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Horizontal scrollable container */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex gap-4 overflow-x-auto pb-4 pt-1 px-1",
          "scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent",
          "scroll-smooth snap-x snap-mandatory"
        )}
      >
        {/* Meal Plan Cards */}
        {templates.map((template, index) => (
          <div
            key={template.id}
            className="snap-start animate-in fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <CompactMealPlanCard
              template={template}
              isSelected={selectedId === template.id}
              onSelect={onSelectPlan}
              onEdit={onEditDetails}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onCopyShareLink={onCopyShareLink}
              isPending={isPending}
            />
          </div>
        ))}

        {/* Create New Card */}
        <Card
          onClick={onCreatePlan}
          className={cn(
            "w-[180px] h-[160px] flex-shrink-0 cursor-pointer",
            "transition-all duration-200 ease-out",
            "border-2 border-dashed border-border/60",
            "hover:border-brand-300 dark:hover:border-brand-500/50",
            "hover:bg-brand-50/30 dark:hover:bg-brand-500/5",
            "hover:shadow-md hover:-translate-y-0.5",
            "flex flex-col items-center justify-center gap-3",
            "snap-start group/create"
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-xl",
              "bg-brand-100 dark:bg-brand-500/20",
              "flex items-center justify-center",
              "transition-transform duration-200",
              "group-hover/create:scale-110"
            )}
          >
            <Plus className="w-5 h-5 text-brand-500" />
          </div>
          <div className="text-center">
            <span className="text-sm font-medium text-muted-foreground block">
              {t("createPlan")}
            </span>
          </div>
        </Card>
      </div>

      {/* Plan count indicator */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-xs text-muted-foreground">
          {templates.length} {templates.length === 1 ? "plan" : "plans"}
        </span>
        {templates.length > 3 && (
          <span className="text-xs text-muted-foreground">
            Scroll for more →
          </span>
        )}
      </div>
    </div>
  );
}
