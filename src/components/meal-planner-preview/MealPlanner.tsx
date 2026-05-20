"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/ui/page-container";
import { MealPlanForm } from "@/components/meal-plans/MealPlanForm";
import { ChefHat, PlusIcon, Sparkles, Edit2, CalendarDays, LayoutGrid, Layers, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getMealPlans,
  getMealPlan,
  addMealToDay,
  removeMealFromDay,
  moveMeal,
  updateMealServings,
} from "@/actions/meal-plan";
import { toast } from "sonner";
import {
  toTemplateDisplay,
  type TemplateWithMealsAndSchedules,
} from "@/lib/meal-plan-adapter";
import { PlanSwitcher, GridLayout, StackLayout, SplitLayout, RecipeLibrary } from "./planner";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { WeeklyMacroStrip } from "./WeeklyMacroStrip";
import type { MealPlanTemplateDisplay, MealType } from "@/types/meal-plan";
import { useTranslations } from "next-intl";
import { DndContext, pointerWithin } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import type { Recipe } from "@/generated/prisma";

export function MealPlanner() {
  const t = useTranslations("mealPlans");
  const searchParams = useSearchParams();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<TemplateWithMealsAndSchedules[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<MealPlanTemplateDisplay | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"planner" | "calendar">("planner");
  const [layout, setLayout] = useState<"grid" | "stack" | "split">("grid");
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // ── Handlers ─ AI deep-link ───────────────────────────────────────────────────
  const handleGenerateWithAI = () => {
    window.dispatchEvent(
      new CustomEvent("dietai:open-chat", {
        detail: { prompt: "Generá un plan de comidas para mí" },
      })
    );
  };

  // ── Async state ───────────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(() => {
    startTransition(async () => {
      const result = await getMealPlans({ page: 1, limit: 50 });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setTemplates(
          (result.data.templates as TemplateWithMealsAndSchedules[]) || []
        );
      }
    });
  }, []);

  const handleSelectPlan = useCallback(
    (templateId: string) => {
      setSelectedPlanId(templateId);
      startTransition(async () => {
        const result = await getMealPlan(templateId);
        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          setEditingTemplate(
            toTemplateDisplay(
              result.data as TemplateWithMealsAndSchedules,
              t("calendar.unknownRecipe")
            )
          );
        }
      });
    },
    [t]
  );

  // ── Mutation handlers ─────────────────────────────────────────────────────────

  const handleRemoveMeal = useCallback(
    (mealId: string) => {
      startTransition(async () => {
        const result = await removeMealFromDay(mealId);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(t("mealRemoved"));
          if (selectedPlanId) handleSelectPlan(selectedPlanId);
          loadTemplates();
        }
      });
    },
    [selectedPlanId, handleSelectPlan, loadTemplates, t]
  );

  const handleServingsChange = useCallback(
    (mealId: string, servings: number) => {
      startTransition(async () => {
        const result = await updateMealServings({ mealId, servings });
        if (result.error) {
          toast.error(result.error);
        } else {
          if (selectedPlanId) handleSelectPlan(selectedPlanId);
          loadTemplates();
        }
      });
    },
    [selectedPlanId, handleSelectPlan, loadTemplates]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

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
            const targetDay = editingTemplate?.days.find(
              (d) => d.id === targetDayId
            );
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
              if (selectedPlanId) handleSelectPlan(selectedPlanId);
              loadTemplates();
            }
          });
        }
        return;
      }

      // Handle meal drag (move between slots)
      const sourceMeal = active.data.current?.meal as
        | { id: string; recipeName: string }
        | undefined;
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
            if (selectedPlanId) handleSelectPlan(selectedPlanId);
            loadTemplates();
          }
        });
      }
    },
    [editingTemplate, selectedPlanId, handleSelectPlan, loadTemplates, t]
  );

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Honor ?selected=<id> from URL (e.g. deep link from chat after generateMealPlan)
  useEffect(() => {
    const requested = searchParams.get("selected");
    if (!requested || templates.length === 0 || selectedPlanId === requested) return;
    if (templates.some((tpl) => tpl.id === requested)) {
      handleSelectPlan(requested);
    }
  }, [searchParams, templates, selectedPlanId, handleSelectPlan]);

  // Auto-select first plan when templates load (skipped if ?selected= will resolve)
  useEffect(() => {
    if (templates.length > 0 && !selectedPlanId && !editingTemplate) {
      const requested = searchParams.get("selected");
      if (requested && templates.some((tpl) => tpl.id === requested)) return;
      handleSelectPlan(templates[0].id);
    }
  }, [templates, selectedPlanId, editingTemplate, handleSelectPlan, searchParams]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PageContainer className="space-y-8">
      {/* Hero Header */}
      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
              <ChefHat className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
              {t("mealPlanner")}
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground max-w-lg leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* AI generate button — opens the chat agent pre-seeded with a generate-a-plan prompt */}
          <Button
            variant="outline"
            className={cn(
              "gap-2 h-11 px-5 border-brand-300/60 dark:border-brand-500/30",
              "text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10"
            )}
            onClick={handleGenerateWithAI}
          >
            <Sparkles className="w-4 h-4" />
            Generá con IA
          </Button>

          <Button
            onClick={() => setShowCreateDialog(true)}
            className={cn(
              "gap-2 h-11 px-6 shadow-lg shadow-brand-500/20 transition-all duration-300",
              "hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            )}
            disabled={isPending}
          >
            <PlusIcon className="w-4 h-4" />
            {t("createPlan")}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "planner" | "calendar")}
        className="space-y-6"
      >
        <TabsList className="mb-0">
          <TabsTrigger value="planner">
            <Edit2 className="w-4 h-4 mr-2" />
            {t("mealPlanner")}
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <CalendarDays className="w-4 h-4 mr-2" />
            {t("calendarView")}
          </TabsTrigger>
        </TabsList>

        {/* Planner tab */}
        <TabsContent value="planner" className="space-y-6">
          <PlanSwitcher
            templates={templates}
            activeId={selectedPlanId}
            onPick={handleSelectPlan}
            onCreate={() => setShowCreateDialog(true)}
          />

          {/* Editor body */}
          <DndContext
            collisionDetection={pointerWithin}
            onDragEnd={handleDragEnd}
          >
            <div
              className="grid gap-[18px] items-start"
              style={{ gridTemplateColumns: "300px 1fr" }}
            >
              {/* Recipe library sidebar */}
              <div className="bg-card border border-border rounded-xl p-4 sticky top-0 h-[calc(100vh-280px)]">
                <div className="mb-2.5">
                  <div className="font-display text-[17px] font-semibold text-foreground">
                    Recetas
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Arrastrá a un slot del plan
                  </div>
                </div>
                <div className="h-[calc(100%-50px)]">
                  <RecipeLibrary dense={density === "compact"} />
                </div>
              </div>

              {/* Layout area */}
              <div className="flex flex-col gap-3">
                {/* Layout / density toolbar */}
                <div className="flex items-center gap-3">
                  {/* 3-way layout switcher */}
                  <div className="flex gap-0.5 p-0.5 bg-muted border border-border rounded-lg">
                    {(
                      [
                        { id: "grid", label: "Grid", Icon: LayoutGrid },
                        { id: "stack", label: "Stack", Icon: Layers },
                        { id: "split", label: "Split", Icon: Columns2 },
                      ] as const
                    ).map(({ id, label, Icon: LIcon }) => {
                      const isActive = layout === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setLayout(id)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer",
                            isActive
                              ? "bg-card text-brand-500 shadow-sm"
                              : "bg-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <LIcon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Density toggle */}
                  <div className="flex gap-0.5 p-0.5 bg-muted border border-border rounded-lg">
                    {(["regular", "compact"] as const).map((d) => {
                      const isActive = density === d;
                      const label = d === "regular" ? "Regular" : "Compact";
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDensity(d)}
                          className={cn(
                            "px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-150 cursor-pointer",
                            isActive
                              ? "bg-card text-brand-500 shadow-sm"
                              : "bg-transparent text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly macro summary strip */}
                {editingTemplate && (
                  <WeeklyMacroStrip template={editingTemplate} />
                )}

                {/* Grid / Stack / Split render */}
                <div className="overflow-x-auto">
                  {editingTemplate ? (
                    <>
                      {layout === "grid" && (
                        <GridLayout
                          template={editingTemplate}
                          density={density}
                          onRemove={handleRemoveMeal}
                          onServingsChange={handleServingsChange}
                        />
                      )}
                      {layout === "stack" && (
                        <StackLayout
                          template={editingTemplate}
                          density={density}
                          onRemove={handleRemoveMeal}
                          onServingsChange={handleServingsChange}
                        />
                      )}
                      {layout === "split" && (
                        <SplitLayout
                          template={editingTemplate}
                          density={density}
                          onRemove={handleRemoveMeal}
                          onServingsChange={handleServingsChange}
                        />
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-16 text-sm text-muted-foreground italic">
                      Seleccioná un plan para editarlo
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DndContext>
        </TabsContent>

        {/* Calendar tab */}
        <TabsContent value="calendar" className="space-y-6">
          <ScheduleCalendar templates={templates} onUpdate={loadTemplates} />
        </TabsContent>
      </Tabs>

      {/* Create Meal Plan Dialog */}
      <MealPlanForm
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={(id) => {
          loadTemplates();
          if (id) handleSelectPlan(id);
        }}
      />
    </PageContainer>
  );
}
