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
import { ChefHat, PlusIcon, Sparkles, Edit2, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMealPlans, getMealPlan } from "@/actions/meal-plan";
import { toast } from "sonner";
import {
  toTemplateDisplay,
  type TemplateWithMealsAndSchedules,
} from "@/lib/meal-plan-adapter";
import { PlanSwitcher } from "./planner";
import type { MealPlanTemplateDisplay } from "@/types/meal-plan";
import { useTranslations } from "next-intl";

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
          {/* AI generate button — wired in a later task */}
          <Button
            variant="outline"
            className={cn(
              "gap-2 h-11 px-5 border-brand-300/60 dark:border-brand-500/30",
              "text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-500/10"
            )}
            disabled={isPending}
            onClick={() => {
              /* AI autofill — implemented in a later task */
            }}
          >
            <Sparkles className="w-4 h-4" />
            {t("createPlan")}
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

        {/* Planner tab — body filled in by later tasks */}
        <TabsContent value="planner" className="space-y-6">
          <PlanSwitcher
            templates={templates}
            activeId={selectedPlanId}
            onPick={handleSelectPlan}
            onCreate={() => setShowCreateDialog(true)}
          />
          <div data-placeholder="editor" className="text-xs text-muted-foreground/50 italic">
            {/* editor — Task 6 */}
          </div>
        </TabsContent>

        {/* Calendar tab — body filled in by later tasks */}
        <TabsContent value="calendar" className="space-y-6">
          <div data-placeholder="schedule-calendar" className="text-xs text-muted-foreground/50 italic">
            {/* schedule-calendar — Task 7 */}
          </div>
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
