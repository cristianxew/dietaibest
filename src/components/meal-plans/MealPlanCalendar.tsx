"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MealSlot } from "./MealSlot";
import { MacroDisplay } from "./MacroDisplay";
import { RecipePicker } from "./RecipePicker";
import { RecipeSidebar } from "./RecipeSidebar";
import type {
  MealPlanDisplay,
  DayDisplay,
  MealDisplay,
  MealType,
} from "@/types/meal-plan";
import { moveMeal, addMealToDay, removeMealFromDay } from "@/actions/meal-plan";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus, Utensils, Calendar, Flame } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Recipe } from "@/generated/prisma";
import { cn } from "@/lib/utils";

const CONTAINER_HEIGHT = "h-[calc(100vh-12rem)]";

interface MealPlanCalendarProps {
  mealPlan: MealPlanDisplay;
  onUpdate?: () => void;
}

export function MealPlanCalendar({
  mealPlan,
  onUpdate,
}: MealPlanCalendarProps) {
  const t = useTranslations("mealPlans");
  const [isPending, startTransition] = useTransition();
  const [activeMeal, setActiveMeal] = useState<MealDisplay | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(
    null
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { meal } = event.active.data.current as { meal?: MealDisplay };
    if (meal) {
      setActiveMeal(meal);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveMeal(null);

    if (!over) return;

    const dragType = active.data.current?.type as "meal" | "recipe" | undefined;
    const targetDayId = over.data.current?.dayId as string;
    const targetMealType = over.data.current?.mealType as MealType;

    if (!targetDayId || !targetMealType) return;

    // Handle recipe drag from sidebar
    if (dragType === "recipe") {
      const recipe = active.data.current?.recipe as Recipe;
      if (recipe) {
        startTransition(async () => {
          // Check if target slot already has a meal
          const targetDay = mealPlan.days.find((d) => d.id === targetDayId);
          const existingMeal = targetDay?.meals.find(
            (m) => m.mealType === targetMealType
          );

          // If slot is occupied, remove existing meal first
          if (existingMeal) {
            const removeResult = await removeMealFromDay(existingMeal.id);
            if (removeResult.error) {
              toast.error(removeResult.error);
              return;
            }
          }

          // Add new recipe to slot
          const result = await addMealToDay({
            mealPlanDayId: targetDayId,
            recipeId: recipe.id,
            mealType: targetMealType,
            servings: 1,
          });

          if (result.error) {
            toast.error(result.error);
          } else {
            const message = existingMeal
              ? t("calendar.recipeReplaced", {
                  recipe: recipe.title,
                  existing: existingMeal.recipeName,
                })
              : t("calendar.recipeAdded", {
                  recipe: recipe.title,
                  mealType: targetMealType,
                });
            toast.success(message);
            onUpdate?.();
          }
        });
      }
      return;
    }

    // Handle meal drag (move between slots)
    const sourceMeal = active.data.current?.meal as MealDisplay | undefined;
    const sourceDayId = active.data.current?.sourceDayId as string;
    const sourceMealType = active.data.current?.sourceMealType as MealType;

    // If dropped on same slot, do nothing
    if (sourceDayId === targetDayId && sourceMealType === targetMealType) {
      return;
    }

    // Move the meal
    if (sourceMeal) {
      startTransition(async () => {
        const result = await moveMeal({
          mealId: sourceMeal.id,
          targetDayId,
          targetMealType,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(t("mealMoved"));
          onUpdate?.();
        }
      });
    }
  };

  // Handle removing a meal
  const handleRemoveMeal = (mealId: string) => {
    startTransition(async () => {
      const result = await removeMealFromDay(mealId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("mealRemoved"));
        onUpdate?.();
      }
    });
  };

  // Handle adding a meal from picker
  const handleAddMeal = (dayId: string, mealType: MealType) => {
    setSelectedDay(dayId);
    setSelectedMealType(mealType);
    setPickerOpen(true);
  };

  // Handle recipe selection
  const handleSelectRecipe = (recipeId: string, recipeName: string) => {
    if (!selectedDay || !selectedMealType) return;

    startTransition(async () => {
      const result = await addMealToDay({
        mealPlanDayId: selectedDay,
        recipeId,
        mealType: selectedMealType,
        servings: 1,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          t("calendar.recipeAdded", {
            recipe: recipeName,
            mealType: selectedMealType,
          })
        );
        onUpdate?.();
      }
    });
  };

  // Get meal for a specific day and meal type
  const getMeal = (
    day: DayDisplay,
    mealType: MealType
  ): MealDisplay | undefined => {
    return day.meals.find((m) => m.mealType === mealType);
  };

  // Get meal type icon
  const getMealTypeIcon = (mealType: string) => {
    const icons: Record<string, string> = {
      breakfast: "🌅",
      lunch: "☀️",
      dinner: "🌙",
      snack: "🍎",
      snack1: "🍎",
      snack2: "🥜",
    };
    return icons[mealType.toLowerCase()] || "🍽️";
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Responsive Layout: Sidebar for desktop, stacked for mobile */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        {/* Recipe Sidebar - Desktop Only */}
        <div className={cn("hidden lg:block sticky top-6", CONTAINER_HEIGHT)}>
          <RecipeSidebar />
        </div>

        {/* Main Calendar Area */}
        <Card className={cn("border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden flex flex-col", CONTAINER_HEIGHT)}>
          {/* Header with gradient */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-100/40 to-gold-100/20 dark:from-brand-500/10 dark:to-gold-500/5" />
            <CardHeader className="relative">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 border border-brand-200/50 dark:border-brand-500/20">
                  <Calendar className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="font-display text-lg tracking-tight truncate">
                    {mealPlan.name}
                  </CardTitle>
                  <CardDescription className="mt-0.5">
                    <span className="hidden lg:inline">{t("dragFromSidebar")}</span>
                    <span className="lg:hidden">
                      {mealPlan.days[0]?.date
                        ? t("calendar.dragToReorganizeMobile")
                        : t("calendar.addMealsDescription")}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </div>

          <CardContent className="flex-1 min-h-0 p-0">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-4 pt-2">
                {mealPlan.days.map((day, dayIndex) => (
                  <div
                    key={day.id}
                    className={cn(
                      "relative rounded-2xl border border-border/60 bg-card/50 overflow-hidden transition-all duration-300",
                      "hover:border-brand-200/60 dark:hover:border-brand-500/30 hover:shadow-md"
                    )}
                    style={{ animationDelay: `${dayIndex * 50}ms` }}
                  >
                    {/* Day Content */}
                    <div className="p-4">
                      {/* Day Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col">
                            <h4 className="font-display font-semibold text-foreground tracking-tight">
                              {day.date
                                ? format(day.date, "EEEE")
                                : t("calendar.dayNumber", {
                                    number: day.dayNumber,
                                  })}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              {day.date
                                ? format(day.date, "MMM d, yyyy")
                                : `Day ${day.dayNumber}`}
                            </p>
                          </div>
                        </div>

                        {/* Macro Summary */}
                        <MacroDisplay
                          macros={day.macros}
                          targets={mealPlan.targets}
                          compact
                        />
                      </div>

                      {/* Meal Slots Grid */}
                      <div
                        className={cn(
                          "grid gap-3",
                          mealPlan?.mealSlots?.length <= 3
                            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                            : mealPlan?.mealSlots?.length === 4
                            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                            : mealPlan?.mealSlots?.length === 5
                            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
                            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-6"
                        )}
                      >
                        {mealPlan?.mealSlots?.map((mealType, slotIndex) => {
                          const meal = getMeal(day, mealType);
                          return (
                            <div
                              key={mealType}
                              className="space-y-2"
                              style={{ animationDelay: `${(dayIndex * mealPlan.mealSlots.length + slotIndex) * 30}ms` }}
                            >
                              {/* Meal Type Label */}
                              <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  <span>{getMealTypeIcon(mealType)}</span>
                                  <span>{mealType}</span>
                                </label>
                                {!meal && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 lg:hidden rounded-full hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10 dark:hover:text-brand-400"
                                    onClick={() => handleAddMeal(day.id, mealType)}
                                    disabled={isPending}
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>

                              {/* Meal Slot */}
                              <MealSlot
                                meal={meal}
                                dayId={day.id}
                                mealType={mealType}
                                onRemove={handleRemoveMeal}
                                isDragging={activeMeal?.id === meal?.id}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeMeal ? (
          <div className="w-64 p-4 rounded-2xl bg-card border border-brand-200 dark:border-brand-500/30 shadow-2xl shadow-brand-500/20">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-100 dark:bg-brand-500/20">
                <Utensils className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-sm text-foreground truncate">
                  {activeMeal.recipeName}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Flame className="w-3 h-3 text-brand-500" />
                  {Math.round(activeMeal.calories)} cal
                  <span className="text-muted-foreground/40">•</span>
                  {Math.round(activeMeal.protein)}g protein
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {/* Recipe Picker Dialog - Mobile/Tablet Only */}
      <RecipePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelectRecipe={handleSelectRecipe}
        dayId={selectedDay || undefined}
        mealType={selectedMealType || undefined}
      />
    </DndContext>
  );
}
