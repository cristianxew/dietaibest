"use client";

import { useState, useTransition } from "react";
import { DndContext, DragOverlay, closestCenter } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MealSlot } from "./MealSlot";
import { MacroDisplay } from "./MacroDisplay";
import { RecipePicker } from "./RecipePicker";
import type {
  MealPlanDisplay,
  DayDisplay,
  MealDisplay,
  MealType,
  MEAL_TYPES,
} from "@/types/meal-plan";
import { moveMeal, addMealToDay, removeMealFromDay } from "@/actions/meal-plan";
import { toast } from "sonner";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { calculateWeeklyMacros } from "@/lib/meal-plan-macros";

interface MealPlanCalendarProps {
  mealPlan: MealPlanDisplay;
  onUpdate?: () => void;
}

const MEAL_TYPE_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export function MealPlanCalendar({ mealPlan, onUpdate }: MealPlanCalendarProps) {
  const [isPending, startTransition] = useTransition();
  const [activeMeal, setActiveMeal] = useState<MealDisplay | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null);

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

    const sourceMeal = active.data.current?.meal as MealDisplay | undefined;
    const sourceDayId = active.data.current?.sourceDayId as string;
    const sourceMealType = active.data.current?.sourceMealType as MealType;

    const targetDayId = over.data.current?.dayId as string;
    const targetMealType = over.data.current?.mealType as MealType;

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
          toast.success("Meal moved!");
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
        toast.success("Meal removed!");
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
        toast.success(`${recipeName} added to ${selectedMealType}!`);
        onUpdate?.();
      }
    });
  };

  // Get meal for a specific day and meal type
  const getMeal = (day: DayDisplay, mealType: MealType): MealDisplay | undefined => {
    return day.meals.find((m) => m.mealType === mealType);
  };

  const weeklyMacros = calculateWeeklyMacros(mealPlan.days);

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Weekly Macro Summary */}
        <MacroDisplay
          macros={weeklyMacros.averageDailyMacros}
          targets={mealPlan.targets}
          title="Daily Average Macros"
        />

        {/* Calendar Grid */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Meal Schedule</CardTitle>
            <CardDescription>
              Drag and drop meals to reorganize your plan
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mealPlan.days.map((day) => (
                <div key={day.id} className="border rounded-lg p-4">
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-medium">
                        {format(day.date, "EEEE")}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {format(day.date, "MMM d, yyyy")}
                      </p>
                    </div>
                    <MacroDisplay
                      macros={day.macros}
                      targets={mealPlan.targets}
                      compact
                    />
                  </div>

                  {/* Meal Slots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {MEAL_TYPE_ORDER.map((mealType) => {
                      const meal = getMeal(day, mealType);
                      return (
                        <div key={mealType} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium uppercase text-muted-foreground">
                              {mealType}
                            </label>
                            {!meal && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => handleAddMeal(day.id, mealType)}
                                disabled={isPending}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
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
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeMeal ? (
            <div className="bg-background border rounded-lg p-3 shadow-lg max-w-xs">
              <p className="font-medium">{activeMeal.recipeName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(activeMeal.calories)} cal • {Math.round(activeMeal.protein)}g protein
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </div>

      {/* Recipe Picker Dialog */}
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
