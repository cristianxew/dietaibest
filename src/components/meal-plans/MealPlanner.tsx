"use client";

import { useState, useEffect, useTransition, useCallback, useRef, useId } from "react";
import type { ReactNode, RefObject } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { RecipeDetailSheet } from "../recipes/RecipeDetailSheet";
import { mealPlansReturnPath } from "@/lib/recipe-back-link";
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
import { ChefHat, PlusIcon, Sparkles, Edit2, CalendarDays, LayoutGrid, Layers, Columns2, Search, Globe, ChevronDown } from "lucide-react";
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
import { PlanMacroSummary } from "./PlanMacroSummary";
import { MicronutrientPanel } from "./MicronutrientPanel";
import { RecipePicker } from "./RecipePicker";
import { ViewOptionsDrawer } from "./ViewOptionsDrawer";
import type { ReferenceIntakes } from "@/lib/nutrition-rda";
import { MEAL_SLOT_META } from "@/lib/meal-slot-meta";
import type { AddMealData, MealPlanTemplateDisplay, MealType } from "@/types/meal-plan";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { Recipe } from "@/generated/prisma";
import {
  PlanSwitcherSkeleton,
  PlanMacroSummarySkeleton,
  GridLayoutSkeleton,
  StackLayoutSkeleton,
  SplitLayoutSkeleton,
} from "./MealPlannerSkeletons";
import { sumMacros, sumMicros, emptyMicros } from "@/lib/meal-plan-macros";
import { MICRONUTRIENT_KEYS } from "@/lib/nutrition-fields";
import type {
  DayDisplay,
  MacroSummary,
  MicronutrientSummary,
} from "@/types/meal-plan";
import { openChatWithPrompt } from "@/components/chat/openChat";
import { useIsTouchFirst, useViewportTier } from "@/hooks/use-media-query";
import { useHeightCssVar } from "@/hooks/use-height-css-var";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";

/**
 * Vertical hit slop so 36px controls below `lg` still give a 44px touch target.
 * Switched off from `lg`, where the desktop controls keep their own sizing.
 */
const HIT_SLOP_Y =
  "relative after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] lg:after:hidden";

/** Tab triggers: recipes-style 36px segmented control below `lg`, StyledTabs look from `lg`. */
const TAB_TRIGGER_CLASS = cn(
  "flex-1 sm:flex-none min-w-0 whitespace-nowrap px-2 sm:px-3.5 lg:px-4 lg:touch:min-h-11",
  "max-lg:py-2 max-lg:rounded-md max-lg:border-0 max-lg:text-[13px] max-lg:data-[state=active]:text-brand-500",
  HIT_SLOP_Y
);

/**
 * Sticky bar that slides away on scroll down and returns on scroll up below
 * `lg` (the recipes toolbar pattern). It owns the hide state so scrolling
 * re-renders only the bar, not the whole planner; `barRef` still receives the
 * node for the `--planner-toolbar-h` measurement used on desktop.
 */
function HideOnScrollBar({
  barRef,
  disabled,
  className,
  children,
}: {
  barRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { ref, hidden } = useHideOnScroll({ disabled });
  const setNode = useCallback(
    (el: HTMLDivElement | null) => {
      barRef.current = el;
      ref(el);
    },
    [barRef, ref]
  );

  return (
    <div ref={setNode} className={cn(className, hidden && "max-lg:-translate-y-full")}>
      {children}
    </div>
  );
}

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

      const baseMicros = base.micros ?? emptyMicros();
      const scaledMicros = {} as MicronutrientSummary;
      for (const key of MICRONUTRIENT_KEYS) {
        scaledMicros[key] = scale(baseMicros[key] ?? 0);
      }

      return {
        ...meal,
        servings: newServings,
        calories: scale(base.calories),
        protein: scale(base.protein),
        carbs: scale(base.carbs),
        fat: scale(base.fat),
        micros: scaledMicros,
      };
    });

    return {
      ...day,
      meals: updatedMeals,
      macros: sumMacros(updatedMeals),
      micros: sumMicros(updatedMeals.map((m) => m.micros)),
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

  const averageMicros: MicronutrientSummary = emptyMicros();
  if (updatedDays.length) {
    const summed = sumMicros(updatedDays.map((d) => d.micros));
    for (const key of MICRONUTRIENT_KEYS) {
      averageMicros[key] = Math.round((summed[key] / updatedDays.length) * 10) / 10;
    }
  }

  return {
    ...template,
    days: updatedDays,
    averageMacros,
    averageMicros,
  };
}

interface MealPlannerProps {
  /** Micronutrient reference intakes (personalized or standard DV). */
  reference: ReferenceIntakes;
  /** Optional banner rendered at the top of the planner's scroll area. */
  banner?: React.ReactNode;
}

export function MealPlanner({ reference, banner }: MealPlannerProps) {
  const t = useTranslations("mealPlans");
  // The app's shared "Undo" label lives with the nutrition hub swaps
  const tUndo = useTranslations("nutritionHub.myWeek.swaps");
  const searchParams = useSearchParams();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

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
  const [selectedRecipeIdForDetail, setSelectedRecipeIdForDetail] = useState<string | null>(null);

  // Tap-to-add: which (day, slot) the recipe picker is targeting. Offered on
  // every touch-first surface (phones, tablets, coarse pointers) next to drag.
  const [pickerSlot, setPickerSlot] = useState<{ dayId: string; mealType: MealType } | null>(null);
  const tier = useViewportTier();
  const touchFirst = useIsTouchFirst();
  // Grid needs width, so phones fall back to Stack when Grid is stored; the
  // stored choice comes back on wider tiers.
  const effectiveLayout = tier === "phone" && layout === "grid" ? "stack" : layout;
  const [showRecipePanel, setShowRecipePanel] = useState(false);
  const [viewOptionsOpen, setViewOptionsOpen] = useState(false);
  const servingsSwitchId = useId();
  // The toolbar only hides below lg, and never while an overlay is open.
  const toolbarPinned =
    tier === "desktop" ||
    showCreateDialog ||
    pickerSlot !== null ||
    selectedRecipeIdForDetail !== null ||
    viewOptionsOpen;

  const sensors = useSensors(
    // A few px of movement before a mouse drag starts, so plain clicks (and the
    // compatibility mouse events a phone fires after a tap) still reach onClick.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  useHeightCssVar(toolbarRef, scrollRef, "--planner-toolbar-h", activeTab);
  useHeightCssVar(controlsRef, scrollRef, "--planner-controls-h", activeTab);
  
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

  // Latest values for toast callbacks, which can run after the plan or its
  // meals changed
  const selectedPlanIdRef = useRef(selectedPlanId);
  selectedPlanIdRef.current = selectedPlanId;
  const editingTemplateRef = useRef(editingTemplate);
  editingTemplateRef.current = editingTemplate;

  const refreshPlan = useCallback(
    (planId: string | null) => {
      // Skip the plan reload if the user has switched plans since
      if (planId && planId === selectedPlanIdRef.current) {
        handleSelectPlan(planId, { showLoading: false });
      }
      loadTemplates({ showLoading: false });
    },
    [handleSelectPlan, loadTemplates]
  );

  const handleUndoRemoveMeal = useCallback(
    (removed: AddMealData, planId: string | null) => {
      // Never stack a second meal into a slot that was filled in the meantime
      const slotTaken = editingTemplateRef.current?.days
        .find((d) => d.id === removed.mealPlanDayId)
        ?.meals.some((m) => m.mealType === removed.mealType);
      if (slotTaken) {
        toast.error(t("undoSlotTaken"));
        return;
      }
      startTransition(async () => {
        const result = await addMealToDay(removed);
        if (result.error) {
          toast.error(result.error);
        } else {
          refreshPlan(planId);
        }
      });
    },
    [refreshPlan, t]
  );

  const handleRemoveMeal = useCallback(
    (mealId: string) => {
      // Capture what's needed to put the meal back before it's gone
      const day = editingTemplateRef.current?.days.find((d) =>
        d.meals.some((m) => m.id === mealId)
      );
      const meal = day?.meals.find((m) => m.id === mealId);
      const removed: AddMealData | null =
        day && meal?.recipeId
          ? {
            mealPlanDayId: day.id,
            recipeId: meal.recipeId,
            mealType: meal.mealType,
            servings: meal.servings,
          }
          : null;
      const planId = selectedPlanId;

      startTransition(async () => {
        const result = await removeMealFromDay(mealId);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            t("mealRemoved"),
            removed
              ? { action: { label: tUndo("undo"), onClick: () => handleUndoRemoveMeal(removed, planId) } }
              : undefined
          );
          refreshPlan(planId);
        }
      });
    },
    [selectedPlanId, refreshPlan, handleUndoRemoveMeal, t, tUndo]
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

  // Honor ?selected=<id> from URL (deep link from chat after generateMealPlan, or
  // "Back to Meal Plans" on a recipe page). Applied once per value: the param
  // stays in the URL, so re-applying it whenever the selection changed would
  // snap the user back to it after picking another plan.
  const appliedSelectedParam = useRef<string | null>(null);
  useEffect(() => {
    const requested = searchParams.get("selected");
    if (!requested || templates.length === 0 || appliedSelectedParam.current === requested) return;
    appliedSelectedParam.current = requested;
    if (selectedPlanId !== requested && templates.some((tpl) => tpl.id === requested)) {
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

  /** Search + category filters; `stacked` fills the narrow desktop sidebar. */
  const renderRecipeFilters = (stacked = false) => (
    <>
      <div className={cn("relative min-w-0", stacked ? "w-full" : "flex-1")}>
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Search className="w-4 h-4" />
        </div>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchRecipes")}
          className={cn(
            "w-full py-2 touch:py-3 pr-3 pl-[38px] rounded-lg border border-border bg-background text-foreground font-sans text-[13px] touch:text-base outline-none transition-all duration-200",
            "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
          )}
        />
      </div>
      <div className={cn("flex-shrink-0", stacked && "w-full")}>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger
            className={cn(
              "w-full h-9 touch:h-11 border-border bg-background text-[13px] font-medium hover:border-brand-300 dark:hover:border-brand-500/50 transition-all duration-200",
              !stacked && "sm:w-[180px]"
            )}
          >
            <SelectValue placeholder={t("allCategories")} />
          </SelectTrigger>
          <SelectContent className="border-border">
            <SelectItem value="all" className="text-xs touch:min-h-11">
              {t("allCategories")}
            </SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.name} className="text-xs touch:min-h-11">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PageContainer viewport>
      <Tabs
        ref={scrollRef}
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "planner" | "calendar" | "discover")}
        className="flex flex-col flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative scrollbar-thin"
      >
        {banner}
        {/* Hero Header — below lg the page actions sit here, right of the title
            (recipes pattern); phones drop the description */}
        <div className="px-4 sm:px-6 lg:px-10 pt-4 sm:pt-6 lg:pt-8 bg-background">
          <div className="flex items-end justify-between gap-4 pb-3 sm:pb-5">
            <div className="min-w-0 space-y-0.5 sm:space-y-3">
              <h1 className="text-3xl lg:text-[2rem] font-display font-bold text-foreground tracking-tight">
                {t("title")}
              </h1>
              {/* Onboarding copy: only for users with no plans yet, so the plan
                  itself stays above the fold for everyone else */}
              {!isLoadingTemplates && templates.length === 0 && (
                <p className="hidden sm:block text-base text-muted-foreground max-w-lg leading-relaxed">
                  {t("subtitle")}
                </p>
              )}
            </div>

            <div className="flex lg:hidden items-center gap-2 shrink-0">
              <Button
                variant="outline"
                aria-label={t("generateWithAI")}
                className={cn(
                  "relative after:absolute after:-inset-0.5 after:content-['']",
                  "h-10 w-10 sm:w-auto has-[>svg]:px-0 sm:has-[>svg]:px-3.5 border-brand-300/60 dark:border-brand-500/30",
                  "text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                )}
                onClick={handleGenerateWithAI}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{t("generateWithAI")}</span>
              </Button>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className={cn(
                  "relative after:absolute after:-inset-0.5 after:content-['']",
                  "h-10 px-4 gap-1.5 shadow-sm bg-brand-500 hover:bg-brand-600 text-white transition-all"
                )}
                disabled={isPending}
              >
                <PlusIcon className="w-4 h-4 flex-shrink-0" />
                {t("createPlan")}
              </Button>
            </div>
          </div>
        </div>

        {/* Tab nav — sticky on every tier; below lg it is a full-bleed recipes-style
            bar that hides on scroll down and returns on scroll up. Phones get the
            planner view options in a drawer; the page actions live in the header
            below lg and at the end of this bar from lg up. */}
        <HideOnScrollBar
          barRef={toolbarRef}
          disabled={toolbarPinned}
          className={cn(
            "sticky top-0 z-30 px-4 sm:px-6 lg:px-10 py-3 lg:py-4",
            "bg-background/95 backdrop-blur-md lg:backdrop-blur-sm border-b border-border/60 lg:border-border",
            "transition-transform duration-300 ease-out motion-reduce:transition-none",
            "flex flex-row flex-wrap items-center justify-between gap-2 sm:gap-3 lg:gap-4"
          )}
        >
          {/* Short text-only labels on phones, icon + short label on tablets, full labels from lg */}
          <TabsList className="mb-0 flex-1 sm:flex-none min-w-0 max-lg:gap-1 max-lg:p-0.5">
            <TabsTrigger value="planner" className={TAB_TRIGGER_CLASS}>
              <Edit2 className="hidden sm:block w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate lg:hidden">{t("tabs.plannerShort")}</span>
              <span className="hidden lg:inline">{t("mealPlanner")}</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className={TAB_TRIGGER_CLASS}>
              <CalendarDays className="hidden sm:block w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate lg:hidden">{t("tabs.calendarShort")}</span>
              <span className="hidden lg:inline">{t("calendarView")}</span>
            </TabsTrigger>
            <TabsTrigger value="discover" className={TAB_TRIGGER_CLASS}>
              <Globe className="hidden sm:block w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate lg:hidden">{t("tabs.discoverShort")}</span>
              <span className="hidden lg:inline">{t("discoverTab")}</span>
            </TabsTrigger>
          </TabsList>

          {activeTab === "planner" && (
            <ViewOptionsDrawer
              open={viewOptionsOpen}
              onOpenChange={setViewOptionsOpen}
              layout={effectiveLayout}
              onLayoutChange={setLayout}
              density={density}
              onDensityChange={setDensity}
              showServings={showServings}
              onShowServingsChange={setShowServings}
              className="sm:hidden"
            />
          )}

          <div className="hidden lg:flex items-center gap-3 ml-auto">
            <Button
              variant="outline"
              className={cn(
                "flex-1 sm:flex-none gap-2 h-10 touch:h-11 px-3 sm:px-4 border-brand-300/60 dark:border-brand-500/30 text-xs",
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
                "flex-1 sm:flex-none gap-2 h-10 touch:h-11 px-3 sm:px-5 text-[#1C1A17] transition-all duration-300 text-xs",
                "shadow-[0_4px_14px_rgba(224,122,95,0.30)] hover:shadow-[0_6px_18px_rgba(224,122,95,0.40)]",
                "hover:-translate-y-0.5"
              )}
              disabled={isPending}
            >
              <PlusIcon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t("createPlan")}</span>
            </Button>
          </div>
        </HideOnScrollBar>

        {/* ── Non-scrollable body container (main viewport handles scroll) ── */}
        <div className="flex-1 min-h-0">
          {/* Planner tab. Every tab's bottom padding clears the fixed chat FAB
              (h-14 at bottom-6, see ChatFAB) on every tier: it only hides on
              scroll below lg, so the last row must clear it on desktop too. */}
          <TabsContent value="planner" className="px-4 sm:px-6 lg:px-10 pt-4 lg:pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-24 space-y-3 sm:space-y-4 lg:space-y-5">
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
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex flex-col gap-3 lg:gap-4">
                {/* Plan macro summary (daily average vs daily target) — full width */}
                {isLoadingTemplates || isLoadingPlan ? (
                  <PlanMacroSummarySkeleton />
                ) : (
                  editingTemplate && <PlanMacroSummary template={editingTemplate} />
                )}
                {/* Unified control panel wrapper — phones get these controls in the
                    toolbar's view options drawer; tablets get a bare compact row */}
                <div
                  ref={controlsRef}
                  className="hidden sm:block relative lg:sticky lg:top-[var(--planner-toolbar-h,78px)] z-20 lg:py-2 bg-background"
                >
                  {/* View controls: Layout + Density + Servings. The recipe search and
                      category filters live with the recipes they filter: the desktop
                      sidebar, the tablet recipe panel, and the phone picker. With only
                      view controls left, a bare right-aligned row replaces the card. */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between lg:justify-end gap-4">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {/* Layout switcher (sm+; phones pick Stack/Split in the view options drawer) */}
                      <div className="flex gap-0.5 p-0.5 bg-muted border border-border rounded-lg">
                        {(
                          [
                            { id: "grid", Icon: LayoutGrid },
                            { id: "stack", Icon: Layers },
                            { id: "split", Icon: Columns2 },
                          ] as const
                        ).map(({ id, Icon: LIcon }) => {
                          const isActive = effectiveLayout === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setLayout(id)}
                              className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1.5 max-lg:min-h-9 lg:touch:min-h-11 rounded-md text-[11px] touch:text-xs font-semibold transition-all duration-150 cursor-pointer",
                                HIT_SLOP_Y,
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
                                "px-2.5 py-1.5 max-lg:min-h-9 lg:touch:min-h-11 rounded-md text-[11px] touch:text-xs font-semibold transition-all duration-150 cursor-pointer",
                                HIT_SLOP_Y,
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
                      <label
                        htmlFor={servingsSwitchId}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-1 bg-muted border border-border rounded-lg h-[30px] max-lg:h-[42px] lg:touch:h-11 cursor-pointer",
                          HIT_SLOP_Y
                        )}
                      >
                        <span className="text-[11px] touch:text-xs font-semibold text-muted-foreground">
                          {t("showServings")}
                        </span>
                        <Switch
                          id={servingsSwitchId}
                          checked={showServings}
                          onCheckedChange={setShowServings}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Tablet: collapsible recipe panel (drag by press-and-hold) */}
                {tier === "tablet" && (
                  <div className="bg-card border border-border rounded-xl">
                    <button
                      type="button"
                      onClick={() => setShowRecipePanel((v) => !v)}
                      aria-expanded={showRecipePanel}
                      className="flex w-full items-center justify-between gap-3 px-4 min-h-12 text-left cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block font-display text-[17px] font-semibold text-foreground">
                          {t("recipes")}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {t("holdToDrag")}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-5 h-5 flex-shrink-0 text-muted-foreground transition-transform duration-200",
                          showRecipePanel && "rotate-180"
                        )}
                      />
                    </button>
                    {showRecipePanel && (
                      <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                        <div className="flex flex-row items-center gap-3">{renderRecipeFilters()}</div>
                        <div className="h-[40dvh] min-h-[240px]">
                          <RecipeLibrary
                            dense={density === "compact"}
                            searchQuery={searchQuery}
                            selectedCategory={selectedCategory}
                            planId={selectedPlanId}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2-column grid: recipe library + meal layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 lg:gap-[18px] items-start">
                  {/* Recipe library sidebar — drag source, desktop widths only. A flex
                      column so the list takes whatever height the header and filters
                      leave and scrolls inside the sidebar. */}
                  {tier === "desktop" && (
                    <div className="flex flex-col bg-card border border-border rounded-xl p-4 lg:h-[calc(100dvh-var(--planner-toolbar-h,78px)-var(--planner-controls-h,100px)-32px)] lg:sticky lg:top-[calc(var(--planner-toolbar-h,78px)+var(--planner-controls-h,100px))] z-10">
                      <div className="shrink-0">
                        <div className="font-display text-[17px] font-semibold text-foreground">
                          {t("recipes")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {touchFirst ? t("holdToDrag") : t("dragToSlot")}
                        </div>
                        <div className="flex flex-col gap-2 mt-3">{renderRecipeFilters(true)}</div>
                      </div>
                      <div className="flex-1 min-h-0 pt-3">
                        <RecipeLibrary
                          dense={density === "compact"}
                          searchQuery={searchQuery}
                          selectedCategory={selectedCategory}
                          planId={selectedPlanId}
                        />
                      </div>
                    </div>
                  )}

                  {/* Meal layout */}
                  <div className="min-w-0">
                    {isLoadingTemplates || isLoadingPlan ? (
                      <>
                        {effectiveLayout === "grid" && (
                          <GridLayoutSkeleton density={density} />
                        )}
                        {effectiveLayout === "stack" && (
                          <StackLayoutSkeleton density={density} />
                        )}
                        {effectiveLayout === "split" && (
                          <SplitLayoutSkeleton density={density} />
                        )}
                      </>
                    ) : editingTemplate ? (
                      <>
                        {effectiveLayout === "grid" && (
                          <GridLayout
                            template={editingTemplate}
                            density={density}
                            onRemove={handleRemoveMeal}
                            onServingsChange={handleServingsChange}
                            onSlotSelect={touchFirst ? handleOpenPicker : undefined}
                            showServings={showServings}
                            onViewRecipeDetail={setSelectedRecipeIdForDetail}
                          />
                        )}
                        {effectiveLayout === "stack" && (
                          <StackLayout
                            template={editingTemplate}
                            density={density}
                            onRemove={handleRemoveMeal}
                            onServingsChange={handleServingsChange}
                            onSlotSelect={touchFirst ? handleOpenPicker : undefined}
                            showServings={showServings}
                            reference={reference}
                            onViewRecipeDetail={setSelectedRecipeIdForDetail}
                          />
                        )}
                        {effectiveLayout === "split" && (
                          <SplitLayout
                            template={editingTemplate}
                            density={density}
                            onRemove={handleRemoveMeal}
                            onServingsChange={handleServingsChange}
                            onSlotSelect={touchFirst ? handleOpenPicker : undefined}
                            showServings={showServings}
                            reference={reference}
                            onViewRecipeDetail={setSelectedRecipeIdForDetail}
                          />
                        )}
                        {/* Daily-average micronutrient totals — after the days so
                            the plan starts right below the summary and controls */}
                        <MicronutrientPanel
                          variant="aggregate"
                          micros={editingTemplate.averageMicros}
                          reference={reference}
                          className="mt-3 lg:mt-4"
                        />
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
                      <p className="text-[11px] touch:text-xs text-muted-foreground mt-0.5">
                        {activeDrag.type === "recipe" ? t("dragToSlot") : t("moveMeal")}
                      </p>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          {/* Calendar tab */}
          <TabsContent value="calendar" className="px-4 sm:px-6 lg:px-10 pt-4 lg:pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-24 space-y-6">
            <ScheduleCalendar templates={templates} onUpdate={loadTemplates} />
          </TabsContent>

          {/* Discover tab: browse other users' public plans */}
          <TabsContent value="discover" className="px-4 sm:px-6 lg:px-10 pt-4 lg:pt-6 pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-24">
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
      <RecipeDetailSheet
        recipeId={selectedRecipeIdForDetail}
        onClose={() => setSelectedRecipeIdForDetail(null)}
        locale={locale}
        from={mealPlansReturnPath(selectedPlanId)}
      />
    </PageContainer>
  );
}
