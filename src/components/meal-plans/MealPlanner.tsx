"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageContainer } from "@/components/ui/page-container";
import { MealPlanForm } from "@/components/meal-plans/MealPlanForm";
import { ChefHat, PlusIcon, Sparkles, Edit2, CalendarDays, LayoutGrid, Layers, Columns2, Search, Globe } from "lucide-react";
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
import { PublicPlans } from "./PublicPlans";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { WeeklyMacroStrip } from "./WeeklyMacroStrip";
import { RecipePicker } from "./RecipePicker";
import { MEAL_SLOT_META } from "@/lib/meal-slot-meta";
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
import { sumMacros } from "@/lib/meal-plan-macros";
import type { DayDisplay, MacroSummary } from "@/types/meal-plan";
import { openChatWithPrompt } from "@/components/chat/openChat";

function updateTemplateServingsOptimistically(
  template: MealPlanTemplateDisplay,
  mealId: string,
  newServings: number,
  // Always derive per-serving base from the pre-click snapshot to avoid
  // compounding rounding drift when the user changes servings rapidly
  originalTemplate: MealPlanTemplateDisplay | undefined
): MealPlanTemplateDisplay {
  const originalMeal = originalTemplate?.days
    .flatMap((d) => d.meals)
    .find((m) => m.id === mealId);

  const updatedDays = template.days.map((day) => {
    const updatedMeals = day.meals.map((meal) => {
      if (meal.id !== mealId) return meal;

      const base = originalMeal ?? meal;
      const baseServings = base.servings || 1;
      const scale = (v: number) => Math.round((v / baseServings) * newServings * 10) / 10;

      return {
        ...meal,
        servings: newServings,
        calories: scale(base.calories),
        protein: scale(base.protein),
        carbs: scale(base.carbs),
        fat: scale(base.fat),
      };
    });

    return {
      ...day,
      meals: updatedMeals,
      macros: sumMacros(updatedMeals),
    };
  });

  const avg = (pick: (d: DayDisplay) => number) =>
    Math.round((updatedDays.reduce((s, d) => s + pick(d), 0) / updatedDays.length) * 10) / 10;

  const averageMacros: MacroSummary = updatedDays.length
    ? {
      calories: avg((d) => d.macros.calories),
      protein: avg((d) => d.macros.protein),
      carbs: avg((d) => d.macros.carbs),
      fat: avg((d) => d.macros.fat),
    }
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  return {
    ...template,
    days: updatedDays,
    averageMacros,
  };
}

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
  const [activeTab, setActiveTab] = useState<"planner" | "calendar" | "discover">("planner");
  const [activeDrag, setActiveDrag] = useState<{
    type: "recipe" | "meal";
    name: string;
    image?: string | null;
  } | null>(null);
  const [layout, setLayout] = useState<"grid" | "stack" | "split">("stack");
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showServings, setShowServings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Tap-to-add: which (day, slot) the recipe picker is targeting. This is a
  // mobile-only add path (drag-and-drop from the sidebar stays the desktop flow).
  const [pickerSlot, setPickerSlot] = useState<{ dayId: string; mealType: MealType } | null>(null);
  // True below the `lg` breakpoint, where the drag library is hidden and meal
  // slots become tap-to-add. Kept in sync with the CSS breakpoint so desktop
  // behavior is never altered.
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsCompactViewport(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  // ── Debounced Servings mutation refs ─────────────────────────────────────────
  const servingsTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingServingsRef = useRef<Record<string, number>>({});
  const originalTemplatesRef = useRef<Record<string, MealPlanTemplateDisplay>>({});
  const inFlightServingsRef = useRef<Set<string>>(new Set());

  // Clean up timeouts on unmount
  useEffect(() => {
    const timeouts = servingsTimeoutRef.current;
    return () => {
      Object.values(timeouts).forEach(clearTimeout);
    };
  }, []);

  // ── Handlers ─ AI deep-link ───────────────────────────────────────────────────
  const handleGenerateWithAI = () => {
    openChatWithPrompt(t("aiGeneratePrompt"));
  };

  // ── Async state ───────────────────────────────────────────────────────────────
  const [isPending, startTransition] = useTransition();

  // ── Handlers ──────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback((options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (showLoading) {
      setIsLoadingTemplates(true);
    }
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
        if (showLoading) {
          setIsLoadingTemplates(false);
        }
      }
    });
  }, []);

  const handleSelectPlan = useCallback(
    (templateId: string, options?: { showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? true;
      setSelectedPlanId(templateId);
      if (showLoading) {
        setIsLoadingPlan(true);
      }
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
          if (showLoading) {
            setIsLoadingPlan(false);
          }
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
          if (selectedPlanId) handleSelectPlan(selectedPlanId, { showLoading: false });
          loadTemplates({ showLoading: false });
        }
      });
    },
    [selectedPlanId, handleSelectPlan, loadTemplates, t]
  );

  const handleServingsChange = useCallback(
    (mealId: string, servings: number) => {
      const prevTemplate = editingTemplate;
      if (!prevTemplate) return;

      // Save the original template before the sequence of fast clicks if we haven't already
      if (!originalTemplatesRef.current[mealId]) {
        originalTemplatesRef.current[mealId] = prevTemplate;
      }

      // 1. Instantly update the UI state optimistically
      setEditingTemplate(
        updateTemplateServingsOptimistically(prevTemplate, mealId, servings, originalTemplatesRef.current[mealId])
      );

      // 2. Track the latest servings value
      pendingServingsRef.current[mealId] = servings;

      // 3. If a write is already in-flight, skip scheduling — the in-flight
      //    write's finally block will flush the pending value when it settles
      if (inFlightServingsRef.current.has(mealId)) return;

      // 4. Debounce the server write
      clearTimeout(servingsTimeoutRef.current[mealId]);
      servingsTimeoutRef.current[mealId] = setTimeout(() => {
        delete servingsTimeoutRef.current[mealId];

        // Drains pending writes sequentially; called recursively from finally
        // to flush any value that arrived while a write was in-flight
        const doWrite = () => {
          const finalServings = pendingServingsRef.current[mealId];
          if (finalServings === undefined) return;
          delete pendingServingsRef.current[mealId];
          inFlightServingsRef.current.add(mealId);

          startTransition(async () => {
            try {
              const result = await updateMealServings({ mealId, servings: finalServings });
              if (result.error) {
                toast.error(result.error);
                const original = originalTemplatesRef.current[mealId];
                if (original) setEditingTemplate(original);
              } else if (pendingServingsRef.current[mealId] === undefined) {
                // Only refresh from the server after the last write in this sequence;
                // intermediate successes would overwrite the optimistic UI state
                if (selectedPlanId) handleSelectPlan(selectedPlanId, { showLoading: false });
                loadTemplates({ showLoading: false });
              }
            } finally {
              inFlightServingsRef.current.delete(mealId);
              if (pendingServingsRef.current[mealId] !== undefined) {
                doWrite();
              } else {
                delete originalTemplatesRef.current[mealId];
              }
            }
          });
        };

        doWrite();
      }, 300);
    },
    [editingTemplate, selectedPlanId, handleSelectPlan, loadTemplates]
  );

  const handleOpenPicker = useCallback((dayId: string, mealType: MealType) => {
    setPickerSlot({ dayId, mealType });
  }, []);

  const handlePickRecipe = useCallback(
    (recipeId: string, recipeName: string) => {
      const slot = pickerSlot;
      if (!slot) return;
      setPickerSlot(null);
      startTransition(async () => {
        // Replace any existing meal in the slot (mirrors the drag-drop path).
        const targetDay = editingTemplate?.days.find((d) => d.id === slot.dayId);
        const existingMeal = targetDay?.meals.find((m) => m.mealType === slot.mealType);

        if (existingMeal) {
          const removeResult = await removeMealFromDay(existingMeal.id);
          if (removeResult.error) {
            toast.error(removeResult.error);
            return;
          }
        }

        const result = await addMealToDay({
          mealPlanDayId: slot.dayId,
          recipeId,
          mealType: slot.mealType,
          servings: 1,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            existingMeal
              ? t("calendar.recipeReplaced", {
                recipe: recipeName,
                existing: existingMeal.recipeName,
              })
              : t("calendar.recipeAdded", {
                recipe: recipeName,
                mealType: slot.mealType,
              })
          );
          if (selectedPlanId) handleSelectPlan(selectedPlanId, { showLoading: false });
          loadTemplates({ showLoading: false });
        }
      });
    },
    [pickerSlot, editingTemplate, selectedPlanId, handleSelectPlan, loadTemplates, t]
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
              if (selectedPlanId) handleSelectPlan(selectedPlanId, { showLoading: false });
              loadTemplates({ showLoading: false });
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
            if (selectedPlanId) handleSelectPlan(selectedPlanId, { showLoading: false });
            loadTemplates({ showLoading: false });
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
        onValueChange={(v) => setActiveTab(v as "planner" | "calendar" | "discover")}
        className="flex flex-col flex-1 min-h-0 overflow-y-auto relative scrollbar-thin"
      >
        {/* Hero Header */}
        <div className="px-4 sm:px-6 lg:px-10 pt-5 sm:pt-6 lg:pt-8 bg-background">
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
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-semibold text-foreground tracking-tight">
                {t("title")}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground max-w-lg leading-relaxed">
                {t("subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div className="sticky top-0 z-30 px-4 sm:px-6 lg:px-10 bg-background/95 backdrop-blur-sm py-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-stretch sm:items-center">
          <TabsList className="mb-0 w-full sm:w-auto">
            <TabsTrigger value="planner" className="flex-1 sm:flex-none">
              <Edit2 className="w-4 h-4 mr-2" />
              {t("mealPlanner")}
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1 sm:flex-none">
              <CalendarDays className="w-4 h-4 mr-2" />
              {t("calendarView")}
            </TabsTrigger>
            <TabsTrigger value="discover" className="flex-1 sm:flex-none">
              <Globe className="w-4 h-4 mr-2" />
              {t("discoverTab")}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              className={cn(
                "flex-1 sm:flex-none gap-2 h-10 px-3 sm:px-4 border-brand-300/60 dark:border-brand-500/30 text-xs",
                "text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10"
              )}
              onClick={handleGenerateWithAI}
            >
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t("generateWithAI")}</span>
            </Button>

            <Button
              onClick={() => setShowCreateDialog(true)}
              className={cn(
                "flex-1 sm:flex-none gap-2 h-10 px-3 sm:px-5 text-[#1C1A17] transition-all duration-300 text-xs",
                "shadow-[0_4px_14px_rgba(224,122,95,0.30)] hover:shadow-[0_6px_18px_rgba(224,122,95,0.40)]",
                "hover:-translate-y-0.5"
              )}
              disabled={isPending}
            >
              <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t("createPlan")}</span>
            </Button>
          </div>
        </div>

        {/* ── Non-scrollable body container (main viewport handles scroll) ── */}
        <div className="flex-1 min-h-0">
          {/* Planner tab */}
          <TabsContent value="planner" className="px-4 sm:px-6 lg:px-10 pt-6 pb-8 space-y-5">
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
                <div className="relative lg:sticky lg:top-[78px] z-20 pt-5 pb-3 bg-background">
                  {/* Unified control panel: Search + Categories + Layout + Density */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                    {/* Left: Search & Category Filters — desktop only (drag library
                        is hidden on mobile, where recipe search lives in the picker modal) */}
                    <div className="hidden lg:flex lg:flex-row lg:items-center gap-3 flex-1 max-w-2xl w-full">
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

                      {/* Servings toggle */}
                      <div className="flex items-center gap-2.5 px-2.5 py-1 bg-muted border border-border rounded-lg h-[30px]">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {t("showServings")}
                        </span>
                        <Switch
                          checked={showServings}
                          onCheckedChange={setShowServings}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2-column grid: recipe library + meal layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 lg:gap-[18px] items-start">
                  {/* Recipe library sidebar — drag source, desktop only.
                      On touch, adding happens by tapping a slot (RecipePicker). */}
                  <div className="hidden lg:block bg-card border border-border rounded-xl p-4 lg:h-[calc(100vh-210px)] lg:sticky lg:top-[178px] z-10">
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
                  <div className="min-w-0 overflow-x-auto">
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
                            onSlotSelect={isCompactViewport ? handleOpenPicker : undefined}
                            showServings={showServings}
                          />
                        )}
                        {layout === "stack" && (
                          <StackLayout
                            template={editingTemplate}
                            density={density}
                            onRemove={handleRemoveMeal}
                            onServingsChange={handleServingsChange}
                            onSlotSelect={isCompactViewport ? handleOpenPicker : undefined}
                            showServings={showServings}
                          />
                        )}
                        {layout === "split" && (
                          <SplitLayout
                            template={editingTemplate}
                            density={density}
                            onRemove={handleRemoveMeal}
                            onServingsChange={handleServingsChange}
                            onSlotSelect={isCompactViewport ? handleOpenPicker : undefined}
                            showServings={showServings}
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
          <TabsContent value="calendar" className="px-4 sm:px-6 lg:px-10 pt-6 pb-8 space-y-6">
            <ScheduleCalendar templates={templates} onUpdate={loadTemplates} />
          </TabsContent>

          {/* Discover tab: browse other users' public plans */}
          <TabsContent value="discover" className="px-4 sm:px-6 lg:px-10 pt-6 pb-8">
            <PublicPlans
              onDuplicated={(id) => {
                loadTemplates({ showLoading: false });
                setActiveTab("planner");
                handleSelectPlan(id);
              }}
            />
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

      {/* Tap-to-add recipe picker (touch-friendly add path) */}
      <RecipePicker
        open={pickerSlot !== null}
        onOpenChange={(open) => {
          if (!open) setPickerSlot(null);
        }}
        onSelectRecipe={handlePickRecipe}
        mealTypeLabel={pickerSlot ? t(MEAL_SLOT_META[pickerSlot.mealType].i18nKey) : undefined}
      />
    </PageContainer>
  );
}
