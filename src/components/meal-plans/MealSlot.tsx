"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, X, Utensils, Flame } from "lucide-react";
import type { MealDisplay, MealType } from "@/types/meal-plan";
import { formatMacroValue } from "@/lib/meal-plan-macros";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useTranslations } from "next-intl";

interface MealSlotProps {
  meal?: MealDisplay;
  dayId: string;
  mealType: MealType;
  onRemove?: (mealId: string) => void;
  isDragging?: boolean;
}

export function MealSlot({
  meal,
  dayId,
  mealType,
  onRemove,
}: MealSlotProps) {
  const t = useTranslations("mealPlans");

  // Set up draggable (if meal exists)
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragNodeRef,
    isDragging: isDraggingSelf,
  } = useDraggable({
    id: meal?.id || `empty-${dayId}-${mealType}`,
    data: {
      type: "meal",
      meal,
      sourceDayId: dayId,
      sourceMealType: mealType,
    },
    disabled: !meal,
  });

  // Set up droppable (always accept drops)
  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `drop-${dayId}-${mealType}`,
    data: {
      dayId,
      mealType,
    },
  });

  // Combine refs for drag and drop
  const setNodeRef = (node: HTMLElement | null) => {
    setDragNodeRef(node);
    setDropNodeRef(node);
  };

  // Empty slot
  if (!meal) {
    return (
      <Card
        ref={setDropNodeRef}
        className={cn(
          "relative p-4 border-2 border-dashed transition-all duration-200 min-h-[90px] flex items-center justify-center",
          "bg-muted/20 hover:bg-muted/30",
          "border-border/40 hover:border-brand-300/50 dark:hover:border-brand-500/30",
          isOver && "border-brand-400 bg-brand-50/50 dark:bg-brand-500/10 scale-[1.02] shadow-md"
        )}
      >
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-2">
            <Utensils className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="text-xs text-muted-foreground/60">
            {t("dropMealHere")}
          </p>
        </div>
      </Card>
    );
  }

  // Filled slot with meal
  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "group relative p-3 transition-all duration-200 overflow-hidden",
        "border-border/60 bg-card/80",
        "hover:border-brand-200/60 dark:hover:border-brand-500/30 hover:shadow-md",
        isDraggingSelf && "opacity-50 scale-95 cursor-grabbing",
        isOver && "ring-2 ring-brand-400/50 ring-inset"
      )}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-gold-50/0 group-hover:from-brand-50/30 group-hover:to-gold-50/20 dark:group-hover:from-brand-500/5 dark:group-hover:to-gold-500/5 transition-all duration-300 pointer-events-none" />

      <div className="relative flex items-start gap-2.5">
        {/* Drag Handle */}
        <button
          {...dragAttributes}
          {...dragListeners}
          className="cursor-grab active:cursor-grabbing touch-none mt-1 p-1 -ml-1 rounded-lg hover:bg-muted/50 transition-colors"
          aria-label={t("slot.dragToMove")}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground/60" />
        </button>

        {/* Meal Image */}
        {meal.recipeImage ? (
          <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-border/40">
            <Image
              src={meal.recipeImage}
              alt={meal.recipeName}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        ) : (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-500/20 dark:to-gold-500/10 flex items-center justify-center flex-shrink-0 border border-brand-200/50 dark:border-brand-500/20">
            <Utensils className="w-5 h-5 text-brand-500 dark:text-brand-400" />
          </div>
        )}

        {/* Meal Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
            {meal.recipeName}
          </p>
          {meal.servings !== 1 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {meal.servings} {t("servings")}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-brand-500/70" />
              {formatMacroValue(meal.calories, "calories")}
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span className="text-sage-600 dark:text-sage-400">
              {formatMacroValue(meal.protein, "macros")} P
            </span>
          </div>
        </div>

        {/* Remove Button */}
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 p-0 rounded-full flex-shrink-0",
              "opacity-0 group-hover:opacity-100 transition-opacity",
              "hover:bg-destructive/10 hover:text-destructive"
            )}
            onClick={() => onRemove(meal.id)}
            aria-label={t("slot.removeMeal")}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}
