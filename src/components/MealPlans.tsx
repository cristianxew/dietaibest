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
import { Badge } from "./ui/badge";
import { Label } from "./ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
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
import { Separator } from "./ui/separator";
import {
  Plus,
  Share,
  Copy,
  Target,
  Trash2,
  Edit,
  CalendarDays,
  Clock,
} from "lucide-react";
import { MealPlanCalendar } from "./meal-plans/MealPlanCalendar";
import { MealPlanForm } from "./meal-plans/MealPlanForm";
// import { MacroDisplay } from "./meal-plans/MacroDisplay";
import { SavedPlansCalendar } from "./meal-plans/SavedPlansCalendar";
import { ArrowLeft, Edit2 } from "lucide-react";
import {
  getMealPlans,
  getMealPlan,
  duplicateMealPlan,
  deleteMealPlan,
} from "@/actions/meal-plan";
import { toast } from "sonner";
import type { MealPlanTemplateDisplay, MealType } from "@/types/meal-plan";
import type { Prisma } from "@/generated/prisma";
// import { format } from "date-fns";
// import { calculateWeeklyMacros } from "@/lib/meal-plan-macros";
// import { cn } from "@/lib/utils";

export default function MealPlans() {
  const [activeTab, setActiveTab] = useState("templates");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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
        toast.success("Meal plan duplicated!");
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
        toast.success("Meal plan deleted!");
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
    toast.success("Share link copied to clipboard!");
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
  const handleEditMeals = (templateId: string) => {
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
              recipeName: meal.recipe?.title || "Unknown",
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
        setActiveTab("edit-meals");
      }
    });
  };

  // Handle switching between meal plans in Edit Meals tab
  const handleSwitchMealPlan = (templateId: string) => {
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
              recipeName: meal.recipe?.title || "Unknown",
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
    <div className="p-6 space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold">Meal Plans</h2>
          <p className="text-muted-foreground">
            Create reusable meal plans and schedule them on your calendar
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="gap-2"
            disabled={isPending}
          >
            <Plus className="w-4 h-4" />
            Create Meal Plan
          </Button>
        </div>
      </div>

      {/* Meal Plan Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="templates">
            My Meal Plans ({templates.length})
          </TabsTrigger>
          <TabsTrigger value="edit-meals">Edit Meals</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        {/* Meal Plans Tab */}
        <TabsContent value="templates" className="space-y-6">
          {isPending && templates.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading meal plans...
              </CardContent>
            </Card>
          )}

          {!isPending && templates.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Meal Plans</h3>
                <p className="text-muted-foreground mb-4">
                  Create reusable meal plans that you can schedule anytime
                </p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Meal Plan
                </Button>
              </CardContent>
            </Card>
          )}

          {templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => {
                const activeSchedulesCount =
                  template.schedules?.filter((s) => s.status === "active")
                    .length || 0;

                return (
                  <Card
                    key={template.id}
                    className="hover:shadow-lg transition-shadow"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <CardTitle className="text-lg line-clamp-1">
                              {template.name}
                            </CardTitle>
                            {template.isPublic && (
                              <Badge
                                variant="secondary"
                                className="flex-shrink-0"
                              >
                                Public
                              </Badge>
                            )}
                          </div>
                          <CardDescription className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            {template.duration}{" "}
                            {template.duration === 1 ? "day" : "days"}
                            {activeSchedulesCount > 0 && (
                              <Badge variant="outline" className="ml-2">
                                {activeSchedulesCount}{" "}
                                {activeSchedulesCount === 1
                                  ? "schedule"
                                  : "schedules"}
                              </Badge>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {template.targetCalories && (
                        <div className="text-center">
                          <p className="text-2xl font-medium">
                            {Math.round(template.targetCalories)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Daily Calories Target
                          </p>
                        </div>
                      )}

                      <Separator />

                      <Button
                        variant="default"
                        size="sm"
                        className="w-full gap-2 mb-2"
                        onClick={() => handleEditMeals(template.id)}
                        disabled={isPending}
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Meals
                      </Button>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(template.id)}
                          disabled={isPending}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit Details
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleDuplicate(template.id)}
                          disabled={isPending}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Duplicate
                        </Button>
                      </div>

                      {template.isPublic && template.shareToken && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          onClick={() =>
                            handleCopyShareLink(template.shareToken!)
                          }
                        >
                          <Share className="w-4 h-4" />
                          Copy Share Link
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive hover:text-destructive"
                        onClick={() => handleDelete(template.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete Meal Plan
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Edit Meals Tab */}
        <TabsContent value="edit-meals" className="space-y-6">
          {editingMealTemplate ? (
            <>
              {/* Header with meal plan selector */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        <Select
                          value={editingMealTemplate.id}
                          onValueChange={handleSwitchMealPlan}
                          disabled={isPending}
                        >
                          <SelectTrigger className="w-full max-w-md">
                            <SelectValue placeholder="Select a meal plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name} ({template.duration}{" "}
                                {template.duration === 1 ? "day" : "days"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <CardDescription>
                        Add meals to each day of your meal plan. Changes will
                        apply to all schedules using this meal plan.
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingMealTemplate(null);
                        setActiveTab("templates");
                      }}
                      className="gap-2 flex-shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back to Meal Plans
                    </Button>
                  </div>
                </CardHeader>
              </Card>

              {/* Meal Plan Calendar */}
              <MealPlanCalendar
                mealPlan={editingMealTemplate}
                onUpdate={() => {
                  // Reload the template to get updated data
                  handleEditMeals(editingMealTemplate.id);
                  // Also reload templates list to show updated meal counts
                  loadTemplates();
                }}
              />
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Edit2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Select a Meal Plan to Edit
                </h3>
                <p className="text-muted-foreground mb-6">
                  Choose a meal plan from the list below to start adding meals
                </p>

                {templates.length > 0 ? (
                  <div className="space-y-2 max-w-md mx-auto">
                    <Label htmlFor="meal-plan-select">Meal Plan</Label>
                    <Select
                      onValueChange={handleSwitchMealPlan}
                      disabled={isPending}
                    >
                      <SelectTrigger id="meal-plan-select">
                        <SelectValue placeholder="Choose a meal plan..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.duration}{" "}
                            {template.duration === 1 ? "day" : "days"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">
                      You don&apos;t have any meal plans yet
                    </p>
                    <Button
                      onClick={() => {
                        setActiveTab("templates");
                        setShowCreateDialog(true);
                      }}
                      className="gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Your First Meal Plan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Calendar View Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Schedule Your Meal Plans
              </CardTitle>
              <CardDescription>
                Drag and drop meal plans from the list onto calendar dates to
                schedule them. You can schedule the same meal plan multiple
                times.
              </CardDescription>
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
          // If a new meal plan was created, automatically open it in Edit Meals tab
          if (createdTemplateId) {
            handleEditMeals(createdTemplateId);
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this meal plan and all its schedules.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
