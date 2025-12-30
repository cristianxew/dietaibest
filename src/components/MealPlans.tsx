"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "./custom-ui/styled-tabs";
import { EmptyStateIcon } from "./custom-ui/EmptyStateIcon";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  CalendarDays,
  Sparkles,
  ChefHat,
} from "lucide-react";
import { MealPlanCalendar } from "./meal-plans/MealPlanCalendar";
import { MealPlanForm } from "./meal-plans/MealPlanForm";
import { MealPlanOverview } from "./meal-plans/MealPlanOverview";
import { SavedPlansCalendar } from "./meal-plans/SavedPlansCalendar";
import { Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getMealPlans,
  getMealPlan,
  duplicateMealPlan,
  deleteMealPlan,
} from "@/actions/meal-plan";
import { toast } from "sonner";
import type { MealPlanTemplateDisplay, MealType } from "@/types/meal-plan";
import type { Prisma } from "@/generated/prisma";
import { useTranslations } from "next-intl";
// import { format } from "date-fns";
// import { calculateWeeklyMacros } from "@/lib/meal-plan-macros";
// import { cn } from "@/lib/utils";

export default function MealPlans() {
  const t = useTranslations("mealPlans");
  const common = useTranslations("common");
  const [activeTab, setActiveTab] = useState("planner");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  type TemplateWithMealsAndSchedules = Prisma.MealPlanTemplateGetPayload<{
    include: {
      days: { include: { meals: { include: { recipe: true } } } };
      schedules: true;
    };
  }>;

  const [templates, setTemplates] = useState<TemplateWithMealsAndSchedules[]>(
    []
  );
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<TemplateWithMealsAndSchedules | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMealTemplate, setEditingMealTemplate] =
    useState<MealPlanTemplateDisplay | null>(null);
  // const [savedPlansView, setSavedPlansView] = useState<"grid" | "calendar">("calendar");

  // Load meal plan templates
  const loadTemplates = useCallback(() => {
    startTransition(async () => {
      const result = await getMealPlans({
        page: 1,
        limit: 50,
      });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setTemplates(
          (result.data.templates as TemplateWithMealsAndSchedules[]) || []
        );
      }
    });
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handle meal plan duplication
  const handleDuplicate = (templateId: string) => {
    startTransition(async () => {
      const result = await duplicateMealPlan(templateId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("planDuplicated"));
        loadTemplates();
      }
    });
  };

  // Handle meal plan deletion
  const handleDelete = (templateId: string) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    const id = templateToDelete;
    if (!id) return;

    startTransition(async () => {
      const result = await deleteMealPlan(id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("planDeleted"));
        // Clear selection if deleted plan was selected
        if (selectedPlanId === id) {
          setSelectedPlanId(null);
          setEditingMealTemplate(null);
        }
        loadTemplates();
      }
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    });
  };

  // Handle share link copy
  const handleCopyShareLink = (shareToken: string) => {
    const url = `${window.location.origin}/meal-plans/shared/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success(t("shareLinkCopied"));
  };

  // Handle template editing
  const handleEdit = (templateId: string) => {
    startTransition(async () => {
      const result = await getMealPlan(templateId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setEditingTemplate(result.data as TemplateWithMealsAndSchedules);
        setShowEditDialog(true);
      }
    });
  };

  // Handle editing meals in template
  const _handleEditMeals = (templateId: string) => {
    startTransition(async () => {
      const result = await getMealPlan(templateId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        const data = result.data as TemplateWithMealsAndSchedules;
        // Transform template data to include calculated macros for each day
        const days = data.days.map((day) => {
          const meals = day.meals || [];
          const macros = meals.reduce(
            (acc, meal) => ({
              calories:
                acc.calories + (meal.recipe?.calories || 0) * meal.servings,
              protein:
                acc.protein + (meal.recipe?.protein || 0) * meal.servings,
              carbs: acc.carbs + (meal.recipe?.carbs || 0) * meal.servings,
              fat: acc.fat + (meal.recipe?.fat || 0) * meal.servings,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return {
            id: day.id,
            dayNumber: day.dayNumber,
            date: undefined,
            macros,
            meals: meals.map((meal) => ({
              id: meal.id,
              recipeId: meal.recipeId,
              recipeName: meal.recipe?.title || t("calendar.unknownRecipe"),
              recipeImage: meal.recipe?.imageUrl || undefined,
              mealType: meal.mealType as unknown as MealType,
              servings: meal.servings,
              calories: (meal.recipe?.calories || 0) * meal.servings,
              protein: (meal.recipe?.protein || 0) * meal.servings,
              carbs: (meal.recipe?.carbs || 0) * meal.servings,
              fat: (meal.recipe?.fat || 0) * meal.servings,
            })),
          };
        });

        const averageMacros = days.length
          ? {
            calories: Math.round(
              days.reduce((s, d) => s + d.macros.calories, 0) / days.length
            ),
            protein: Math.round(
              days.reduce((s, d) => s + d.macros.protein, 0) / days.length
            ),
            carbs: Math.round(
              days.reduce((s, d) => s + d.macros.carbs, 0) / days.length
            ),
            fat: Math.round(
              days.reduce((s, d) => s + d.macros.fat, 0) / days.length
            ),
          }
          : { calories: 0, protein: 0, carbs: 0, fat: 0 };

        const templateWithMacros: MealPlanTemplateDisplay = {
          id: data.id,
          name: data.name,
          duration: data.duration,
          mealSlots:
            data.mealSlots as unknown as MealPlanTemplateDisplay["mealSlots"],
          isPublic: data.isPublic,
          shareToken: data.shareToken ?? undefined,
          targets: {
            calories: data.targetCalories ?? undefined,
            protein: data.targetProtein ?? undefined,
            carbs: data.targetCarbs ?? undefined,
            fat: data.targetFat ?? undefined,
          },
          days,
          averageMacros,
        };

        setEditingMealTemplate(templateWithMacros);
        setSelectedPlanId(templateId);
      }
    });
  };

  // Handle selecting a meal plan (combines selection and data loading)
  const handleSelectPlan = useCallback(
    (templateId: string) => {
      setSelectedPlanId(templateId);
      // Load the meal plan data
      startTransition(async () => {
        const result = await getMealPlan(templateId);
        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          const data = result.data as TemplateWithMealsAndSchedules;
          const days = data.days.map((day) => {
            const meals = day.meals || [];
            const macros = meals.reduce(
              (acc, meal) => ({
                calories:
                  acc.calories + (meal.recipe?.calories || 0) * meal.servings,
                protein:
                  acc.protein + (meal.recipe?.protein || 0) * meal.servings,
                carbs: acc.carbs + (meal.recipe?.carbs || 0) * meal.servings,
                fat: acc.fat + (meal.recipe?.fat || 0) * meal.servings,
              }),
              { calories: 0, protein: 0, carbs: 0, fat: 0 }
            );

            return {
              id: day.id,
              dayNumber: day.dayNumber,
              date: undefined,
              macros,
              meals: meals.map((meal) => ({
                id: meal.id,
                recipeId: meal.recipeId,
                recipeName: meal.recipe?.title || t("calendar.unknownRecipe"),
                recipeImage: meal.recipe?.imageUrl || undefined,
                mealType: meal.mealType as unknown as MealType,
                servings: meal.servings,
                calories: (meal.recipe?.calories || 0) * meal.servings,
                protein: (meal.recipe?.protein || 0) * meal.servings,
                carbs: (meal.recipe?.carbs || 0) * meal.servings,
                fat: (meal.recipe?.fat || 0) * meal.servings,
              })),
            };
          });

          const averageMacros = days.length
            ? {
              calories: Math.round(
                days.reduce((s, d) => s + d.macros.calories, 0) / days.length
              ),
              protein: Math.round(
                days.reduce((s, d) => s + d.macros.protein, 0) / days.length
              ),
              carbs: Math.round(
                days.reduce((s, d) => s + d.macros.carbs, 0) / days.length
              ),
              fat: Math.round(
                days.reduce((s, d) => s + d.macros.fat, 0) / days.length
              ),
            }
            : { calories: 0, protein: 0, carbs: 0, fat: 0 };

          const templateWithMacros: MealPlanTemplateDisplay = {
            id: data.id,
            name: data.name,
            duration: data.duration,
            mealSlots:
              data.mealSlots as unknown as MealPlanTemplateDisplay["mealSlots"],
            isPublic: data.isPublic,
            shareToken: data.shareToken ?? undefined,
            targets: {
              calories: data.targetCalories ?? undefined,
              protein: data.targetProtein ?? undefined,
              carbs: data.targetCarbs ?? undefined,
              fat: data.targetFat ?? undefined,
            },
            days,
            averageMacros,
          };

          setEditingMealTemplate(templateWithMacros);
        }
      });
    },
    [t]
  );

  // Auto-select first plan when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedPlanId && !editingMealTemplate) {
      handleSelectPlan(templates[0].id);
    }
  }, [templates, selectedPlanId, editingMealTemplate, handleSelectPlan]);

  // Handle switching between meal plans (legacy - now using handleSelectPlan)
  const _handleSwitchMealPlan = (templateId: string) => {
    startTransition(async () => {
      const result = await getMealPlan(templateId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        const data = result.data as TemplateWithMealsAndSchedules;
        // Transform template data to include calculated macros for each day
        const days = data.days.map((day) => {
          const meals = day.meals || [];
          const macros = meals.reduce(
            (acc, meal) => ({
              calories:
                acc.calories + (meal.recipe?.calories || 0) * meal.servings,
              protein:
                acc.protein + (meal.recipe?.protein || 0) * meal.servings,
              carbs: acc.carbs + (meal.recipe?.carbs || 0) * meal.servings,
              fat: acc.fat + (meal.recipe?.fat || 0) * meal.servings,
            }),
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
          );

          return {
            id: day.id,
            dayNumber: day.dayNumber,
            date: undefined,
            macros,
            meals: meals.map((meal) => ({
              id: meal.id,
              recipeId: meal.recipeId,
              recipeName: meal.recipe?.title || t("calendar.unknownRecipe"),
              recipeImage: meal.recipe?.imageUrl || undefined,
              mealType: meal.mealType as unknown as MealType,
              servings: meal.servings,
              calories: (meal.recipe?.calories || 0) * meal.servings,
              protein: (meal.recipe?.protein || 0) * meal.servings,
              carbs: (meal.recipe?.carbs || 0) * meal.servings,
              fat: (meal.recipe?.fat || 0) * meal.servings,
            })),
          };
        });

        const averageMacros = days.length
          ? {
            calories: Math.round(
              days.reduce((s, d) => s + d.macros.calories, 0) / days.length
            ),
            protein: Math.round(
              days.reduce((s, d) => s + d.macros.protein, 0) / days.length
            ),
            carbs: Math.round(
              days.reduce((s, d) => s + d.macros.carbs, 0) / days.length
            ),
            fat: Math.round(
              days.reduce((s, d) => s + d.macros.fat, 0) / days.length
            ),
          }
          : { calories: 0, protein: 0, carbs: 0, fat: 0 };

        const templateWithMacros: MealPlanTemplateDisplay = {
          id: data.id,
          name: data.name,
          duration: data.duration,
          mealSlots:
            data.mealSlots as unknown as MealPlanTemplateDisplay["mealSlots"],
          isPublic: data.isPublic,
          shareToken: data.shareToken ?? undefined,
          targets: {
            calories: data.targetCalories ?? undefined,
            protein: data.targetProtein ?? undefined,
            carbs: data.targetCarbs ?? undefined,
            fat: data.targetFat ?? undefined,
          },
          days,
          averageMacros,
        };

        setEditingMealTemplate(templateWithMacros);
        // Don't switch tabs, stay on edit-meals
      }
    });
  };

  return (
    <div className="min-h-screen">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8">
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

          <Button
            onClick={() => setShowCreateDialog(true)}
            className={cn(
              "gap-2 h-11 px-6 shadow-lg shadow-brand-500/20 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            )}
            disabled={isPending}
          >
            <Sparkles className="w-4 h-4" />
            {t("createPlan")}
          </Button>
        </div>

        {/* Meal Plan Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="planner">
              <Edit2 className="w-4 h-4 mr-2" />
              {t("mealPlanner")}
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <CalendarDays className="w-4 h-4 mr-2" />
              {t("calendarView")}
            </TabsTrigger>
          </TabsList>

          {/* Meal Planner Tab - Combined Overview + Editor */}
          <TabsContent value="planner" className="space-y-6 mt-6">
            {/* Compact Meal Plan Overview */}
            <MealPlanOverview
              templates={templates}
              selectedId={selectedPlanId}
              onSelectPlan={handleSelectPlan}
              onCreatePlan={() => setShowCreateDialog(true)}
              onEditDetails={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onCopyShareLink={handleCopyShareLink}
              isPending={isPending}
            />

            {/* Meal Plan Calendar Editor */}
            {editingMealTemplate ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <MealPlanCalendar
                  mealPlan={editingMealTemplate}
                  onUpdate={() => {
                    handleSelectPlan(editingMealTemplate.id);
                    loadTemplates();
                  }}
                />
              </div>
            ) : (
              <Card className="border-2 border-dashed border-border/60 bg-gradient-to-br from-muted/30 to-transparent">
                <CardContent className="py-16 text-center">
                  <EmptyStateIcon icon={Edit2} className="mb-6" />
                  <h3 className="font-display font-semibold text-xl mb-3 text-foreground">
                    {t("selectToEdit")}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                    {t("selectToEditDescription")}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Calendar View Tab */}
          <TabsContent value="calendar" className="space-y-6 mt-6">
            <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-brand-100 dark:bg-brand-500/20">
                    <CalendarDays className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                  </div>
                  <div>
                    <CardTitle className="font-display text-lg">
                      {t("calendar.scheduleTitle")}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {t("calendar.scheduleDescription")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <SavedPlansCalendar savedPlans={templates} onUpdate={loadTemplates} />
          </TabsContent>
        </Tabs>

        {/* Create Meal Plan Dialog */}
        <MealPlanForm
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={(createdTemplateId) => {
            loadTemplates();
            // If a new meal plan was created, automatically select it
            if (createdTemplateId) {
              handleSelectPlan(createdTemplateId);
            }
          }}
        />

        {/* Edit Meal Plan Dialog */}
        {editingTemplate && (
          <MealPlanForm
            open={showEditDialog}
            onOpenChange={(open) => {
              setShowEditDialog(open);
              if (!open) setEditingTemplate(null);
            }}
            onSuccess={loadTemplates}
            editMode
            planId={editingTemplate.id}
            defaultValues={{
              name: editingTemplate.name,
              duration: editingTemplate.duration,
              mealSlots: editingTemplate.mealSlots as unknown as MealType[],
              targetCalories: editingTemplate.targetCalories ?? undefined,
              targetProtein: editingTemplate.targetProtein ?? undefined,
              targetCarbs: editingTemplate.targetCarbs ?? undefined,
              targetFat: editingTemplate.targetFat ?? undefined,
              isPublic: editingTemplate.isPublic,
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display">{t("deleteConfirm")}</AlertDialogTitle>
              <AlertDialogDescription className="leading-relaxed">
                {t("deleteDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-lg">{common("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive hover:bg-destructive/90 rounded-lg"
              >
                {common("delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
