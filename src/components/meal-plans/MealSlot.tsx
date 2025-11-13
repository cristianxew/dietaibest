"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GripVertical, X, Image as ImageIcon } from "lucide-react";
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
  isDragging,
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
          "p-3 border-2 border-dashed transition-colors min-h-[80px] flex items-center justify-center",
          isOver && "border-primary bg-primary/5",
          "hover:border-muted-foreground/30"
        )}
      >
        <p className="text-xs text-muted-foreground text-center">
          {t("dropMealHere")}
        </p>
      </Card>
    );
  }

  // Filled slot with meal
  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "p-3 transition-all",
        isDraggingSelf && "opacity-50 cursor-grabbing",
        isOver && "ring-2 ring-primary",
        "hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <button
          {...dragAttributes}
          {...dragListeners}
          className="cursor-grab active:cursor-grabbing touch-none mt-0.5 hover:text-primary transition-colors"
          aria-label={t("slot.dragToMove")}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Meal Image */}
        {meal.recipeImage ? (
          <div className="relative w-10 h-10 rounded overflow-hidden flex-shrink-0">
            <Image
              src={meal.recipeImage}
              alt={meal.recipeName}
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
        ) : (
          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
          </div>
        )}

        {/* Meal Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">{meal.recipeName}</p>
          {meal.servings !== 1 && (
            <p className="text-xs text-muted-foreground">
              {meal.servings} {t("servings")}
            </p>
          )}
          <div className="flex gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
            <span>{formatMacroValue(meal.calories, "calories")}</span>
            <span className="text-muted-foreground/50">•</span>
            <span>{formatMacroValue(meal.protein, "macros")} protein</span>
          </div>
        </div>

        {/* Remove Button */}
        {onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(meal.id)}
            aria-label={t("slot.removeMeal")}
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>
    </Card>
  );
}
