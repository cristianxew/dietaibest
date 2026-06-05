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
import { ChefHat, PlusIcon, Sparkles, Edit2, CalendarDays, LayoutGrid, Layers, Columns2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCategories } from "@/actions/recipe";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { Recipe } from "@/generated/prisma";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PlanSwitcherSkeleton,
  WeeklyMacroStripSkeleton,
  GridLayoutSkeleton,
  StackLayoutSkeleton,
  SplitLayoutSkeleton,
} from "./MealPlannerSkeletons";

export function MealPlanner() {
  const t = useTranslations("mealPlans");
  const searchParams = useSearchParams();

  // ── Data state ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<TemplateWithMealsAndSchedules[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<MealPlanTemplateDisplay | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isLoadingPlan, setIsLoadingPlan] = useState(false);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"planner" | "calendar">("planner");
  const [activeDrag, setActiveDrag] = useState<{
    type: "recipe" | "meal";
    name: string;
    image?: string | null;
  } | null>(null);
  const [layout, setLayout] = useState<"grid" | "stack" | "split">("grid");
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // ── Handlers ─ AI deep-link ───────────────────────────────────────────────────
  const handleGenerateWithAI = () => {
    window.dispatchEvent(
      new CustomEvent("dietai:open-chat", {
        detail: { prompt: t("aiGeneratePrompt") },
      })
    );
  };

  // ── Async state ───────────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(() => {
    setIsLoadingTemplates(true);
    startTransition(async () => {
      try {
        const result = await getMealPlans({ page: 1, limit: 50 });
        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          setTemplates(
            (result.data.templates as TemplateWithMealsAndSchedules[]) || []
          );
        }
      } finally {
        setIsLoadingTemplates(false);
      }
    });
  }, []);

  const handleSelectPlan = useCallback(
    (templateId: string) => {
      setSelectedPlanId(templateId);
      setIsLoadingPlan(true);
      startTransition(async () => {
        try {
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
        } finally {
          setIsLoadingPlan(false);
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

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "recipe") {
      setActiveDrag({
        type: "recipe",
        name: (data.recipe as Recipe).title,
        image: (data.recipe as Recipe).imageUrl ?? null,
      });
    } else if (data?.type === "meal") {
      setActiveDrag({
        type: "meal",
        name: (data.meal as { recipeName: string }).recipeName,
      });
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
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

  useEffect(() => {
    async function loadCats() {
      const catsResult = await getCategories();
      if (catsResult.data) {
        setCategories(catsResult.data);
      }
    }
    loadCats();
  }, []);

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
    <PageContainer viewport>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "planner" | "calendar")}
        className="flex flex-col flex-1 min-h-0 overflow-y-auto relative scrollbar-thin"
      >
        {/* Hero Header */}
        <div className="px-6 lg:px-10 pt-6 lg:pt-8 bg-background">
          <div className="flex flex-col gap-6 justify-between items-start pb-5">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-[30px] h-[30px] rounded-lg bg-brand-500/[0.14] flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-[15px] h-[15px] text-brand-500 dark:text-brand-600" />
                </div>
                <span className="text-xs font-semibold text-brand-500 dark:text-brand-600 uppercase tracking-widest">
                  {t("mealPlanner")}
                </span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground tracking-tight">
                {t("title")}
              </h1>
              <p className="text-muted-foreground max-w-lg leading-relaxed">
                {t("subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div className="sticky top-0 z-30 px-6 lg:px-10 bg-background/95 backdrop-blur-sm py-4 border-b border-border flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
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

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className={cn(
                "gap-2 h-10 px-4 border-brand-300/60 dark:border-brand-500/30 text-xs",
                "text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10"
              )}
              onClick={handleGenerateWithAI}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {t("generateWithAI")}
            </Button>

            <Button
              onClick={() => setShowCreateDialog(true)}
              className={cn(
                "gap-2 h-10 px-5 text-[#1C1A17] transition-all duration-300 text-xs",
                "shadow-[0_4px_14px_rgba(224,122,95,0.30)] hover:shadow-[0_6px_18px_rgba(224,122,95,0.40)]",
                "hover:-translate-y-0.5"
              )}
              disabled={isPending}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              {t("createPlan")}
            </Button>
          </div>
        </div>

        {/* ── Non-scrollable body container (main viewport handles scroll) ── */}
        <div className="flex-1 min-h-0">
          {/* Planner tab */}
          <TabsContent value="planner" className="px-6 lg:px-10 pt-6 pb-8 space-y-5">
            {/* Plan count */}
            {isLoadingTemplates ? (
              <Skeleton className="h-4 w-24 bg-stone-200 dark:bg-slate-800" />
            ) : (
              <p className="text-[12px] font-semibold text-muted-foreground tracking-[0.04em]">
                {templates.length} {t("savedPlans").toLowerCase()}
              </p>
            )}

            {isLoadingTemplates ? (
              <PlanSwitcherSkeleton />
            ) : (
              <PlanSwitcher
                templates={templates}
                activeId={selectedPlanId}
                onPick={handleSelectPlan}
                onCreate={() => setShowCreateDialog(true)}
              />
            )}

            {/* Editor body */}
            <DndContext
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col gap-4">
                {/* Weekly macro summary strip — full width */}
                {isLoadingTemplates || isLoadingPlan ? (
                  <WeeklyMacroStripSkeleton />
                ) : (
                  editingTemplate && (
                    <WeeklyMacroStrip template={editingTemplate} />
                  )
                )}
                {/* Unified control panel wrapper */}
                <div className="sticky top-[138px] sm:top-[78px] z-20 pt-5 pb-3 bg-background">
                  {/* Unified control panel: Search + Categories + Layout + Density */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                    {/* Left: Search & Category Filters */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl w-full">
                      {/* Search Input */}
                      <div className="relative flex-1">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Search className="w-4 h-4" />
                        </div>
                        <input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t("searchRecipes")}
                          className={cn(
                            "w-full py-2 pr-3 pl-[38px] rounded-lg border border-border bg-background text-foreground font-sans text-[13px] outline-none transition-all duration-200",
                            "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                          )}
                        />
                      </div>

                      {/* Category Dropdown Selector */}
                      <div className="flex-shrink-0">
                        <Select
                          value={selectedCategory}
                          onValueChange={setSelectedCategory}
                        >
                          <SelectTrigger className="w-full sm:w-[180px] h-9 border-border bg-background text-[13px] font-medium hover:border-brand-300 dark:hover:border-brand-500/50 transition-all duration-200">
                            <SelectValue placeholder={t("allCategories")} />
                          </SelectTrigger>
                          <SelectContent className="border-border">
                            <SelectItem value="all" className="text-xs">
                              {t("allCategories")}
                            </SelectItem>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.name} className="text-xs">
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Right: Layout & Density controls */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* 3-way layout switcher */}
                      <div className="flex gap-0.5 p-0.5 bg-muted border border-border rounded-lg">
                        {(
                          [
                            { id: "grid", Icon: LayoutGrid },
                            { id: "stack", Icon: Layers },
                            { id: "split", Icon: Columns2 },
                          ] as const
                        ).map(({ id, Icon: LIcon }) => {
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
                              {t(`layout.${id}`)}
                            </button>
                          );
                        })}
                      </div>

                      {/* Density toggle */}
                      <div className="flex gap-0.5 p-0.5 bg-muted border border-border rounded-lg">
                        {(["regular", "compact"] as const).map((d) => {
                          const isActive = density === d;
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
                              {t(`density.${d}`)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-column grid: recipe library + meal layout */}
                <div
                  className="grid gap-[18px] items-start"
                  style={{ gridTemplateColumns: "300px 1fr" }}
                >
                  {/* Recipe library sidebar */}
                  <div className="bg-card border border-border rounded-xl p-4 sticky top-[290px] md:top-[178px] h-[calc(100vh-320px)] md:h-[calc(100vh-210px)] z-10">
                    <div className="mb-2.5">
                      <div className="font-display text-[17px] font-semibold text-foreground">
                        {t("recipes")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {t("dragToSlot")}
                      </div>
                    </div>
                    <div className="h-[calc(100%-60px)] pt-2.5">
                      <RecipeLibrary
                        dense={density === "compact"}
                        searchQuery={searchQuery}
                        selectedCategory={selectedCategory}
                      />
                    </div>
                  </div>

                  {/* Meal layout */}
                  <div className="overflow-x-auto">
                    {isLoadingTemplates || isLoadingPlan ? (
                      <>
                        {layout === "grid" && (
                          <GridLayoutSkeleton density={density} />
                        )}
                        {layout === "stack" && (
                          <StackLayoutSkeleton density={density} />
                        )}
                        {layout === "split" && (
                          <SplitLayoutSkeleton density={density} />
                        )}
                      </>
                    ) : editingTemplate ? (
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
                        {t("selectPlanToEdit")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* DragOverlay renders into a portal — immune to overflow-y-auto clipping */}
              <DragOverlay dropAnimation={null}>
                {activeDrag ? (
                  <div className="flex gap-2.5 rounded-[10px] border border-brand-400 dark:border-brand-500/60 bg-card shadow-xl shadow-brand-500/20 p-2.5 w-[260px] opacity-95">
                    {activeDrag.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeDrag.image}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center flex-shrink-0">
                        <ChefHat className="w-5 h-5 text-brand-500" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="text-[13px] font-semibold text-foreground truncate">{activeDrag.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {activeDrag.type === "recipe" ? t("dragToSlot") : t("moveMeal")}
                      </p>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          {/* Calendar tab */}
          <TabsContent value="calendar" className="px-6 lg:px-10 pt-6 pb-8 space-y-6">
            <ScheduleCalendar templates={templates} onUpdate={loadTemplates} />
          </TabsContent>
        </div>
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
