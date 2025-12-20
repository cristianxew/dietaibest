"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Copy,
  Share,
  Trash2,
  Clock,
  Flame,
  Calendar,
  Utensils,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import type { Prisma } from "@/generated/prisma";

type TemplateWithMealsAndSchedules = Prisma.MealPlanTemplateGetPayload<{
  include: {
    days: { include: { meals: { include: { recipe: true } } } };
    schedules: true;
  };
}>;

interface CompactMealPlanCardProps {
  template: TemplateWithMealsAndSchedules;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onCopyShareLink?: (shareToken: string) => void;
  isPending: boolean;
}

export function CompactMealPlanCard({
  template,
  isSelected,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onCopyShareLink,
  isPending,
}: CompactMealPlanCardProps) {
  const t = useTranslations("mealPlans");

  const activeSchedulesCount =
    template.schedules?.filter((s) => s.status === "active").length || 0;

  const totalMeals =
    template.days?.reduce((acc, day) => acc + (day.meals?.length || 0), 0) || 0;

  return (
    <Card
      className={cn(
        "group relative w-[180px] h-[160px] flex-shrink-0 cursor-pointer",
        "transition-all duration-200 ease-out",
        "border hover:border-brand-200 dark:hover:border-brand-500/40",
        "hover:shadow-md hover:-translate-y-0.5",
        "overflow-hidden",
        isSelected
          ? "border-brand-400 dark:border-brand-400 bg-brand-50/50 dark:bg-brand-500/5"
          : "border-border/80 bg-card"
      )}
      onClick={() => onSelect(template.id)}
    >
      {/* Left accent bar for selected state */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 transition-all duration-200",
          isSelected
            ? "bg-brand-500"
            : "bg-transparent group-hover:bg-brand-200 dark:group-hover:bg-brand-500/30"
        )}
      />

      {/* Card Content */}
      <div className="p-3 pl-4 h-full flex flex-col">
        {/* Header Row */}
        <div className="flex items-start justify-between gap-1 mb-2">
          {/* Plan Name */}
          <h3
            className={cn(
              "font-medium text-sm line-clamp-2 leading-tight flex-1",
              isSelected ? "text-brand-700 dark:text-brand-300" : "text-foreground"
            )}
          >
            {template.name}
          </h3>

          {/* Selection indicator or dropdown */}
          {isSelected ? (
            <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-white" />
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-6 w-6 p-0 flex-shrink-0 rounded-md",
                    "opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                    "hover:bg-muted"
                  )}
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(template.id);
                  }}
                  disabled={isPending}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {t("editDetails")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(template.id);
                  }}
                  disabled={isPending}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  {t("duplicate")}
                </DropdownMenuItem>
                {template.isPublic && template.shareToken && onCopyShareLink && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyShareLink(template.shareToken!);
                    }}
                  >
                    <Share className="w-4 h-4 mr-2" />
                    {t("copyShareLink")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(template.id);
                  }}
                  disabled={isPending}
                  variant="destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t("deleteMealPlan")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Stats - always visible */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {template.duration}d
          </span>
          <span className="flex items-center gap-1">
            <Utensils className="w-3 h-3" />
            {totalMeals}
          </span>
        </div>

        {/* Calories - always reserve space */}
        <div className="h-7 mb-auto">
          {template.targetCalories ? (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-brand-100/60 dark:bg-brand-500/10">
              <Flame className="w-3 h-3 text-brand-500" />
              <span className="text-xs font-medium text-brand-600 dark:text-brand-400">
                {Math.round(template.targetCalories).toLocaleString()} cal
              </span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50">
              <Flame className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-xs text-muted-foreground/50">No target</span>
            </div>
          )}
        </div>

        {/* Badges - fixed height row at bottom */}
        <div className="flex items-center gap-1.5 h-5 mt-1">
          {template.isPublic && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 rounded bg-gold-100/80 text-gold-700 border-0 dark:bg-gold-500/15 dark:text-gold-400"
            >
              Public
            </Badge>
          )}
          {activeSchedulesCount > 0 && (
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4 rounded bg-sage-100/80 text-sage-700 border-0 dark:bg-sage-500/15 dark:text-sage-400"
            >
              <Calendar className="w-2.5 h-2.5 mr-0.5" />
              {activeSchedulesCount}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

// Loading Skeleton
export function CompactMealPlanCardSkeleton() {
  return (
    <Card className="w-[180px] h-[160px] flex-shrink-0 p-3 pl-4 animate-pulse">
      <div className="h-full flex flex-col">
        <div className="flex items-start justify-between gap-1 mb-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-5 w-5 bg-muted rounded-full" />
        </div>
        <div className="flex gap-3 mb-2">
          <div className="h-3 bg-muted rounded w-8" />
          <div className="h-3 bg-muted rounded w-6" />
        </div>
        <div className="h-7 bg-muted rounded w-20 mb-auto" />
        <div className="h-4 bg-muted rounded w-12" />
      </div>
    </Card>
  );
}
