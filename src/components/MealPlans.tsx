"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
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
  Calendar,
  Plus,
  Download,
  Share,
  Copy,
  Target,
  Trash2,
} from "lucide-react";
import { MealPlanCalendar } from "./meal-plans/MealPlanCalendar";
import { MealPlanForm } from "./meal-plans/MealPlanForm";
import {
  getMealPlans,
  getMealPlan,
  duplicateMealPlan,
  deleteMealPlan,
} from "@/actions/meal-plan";
import type { MealPlanDisplay } from "@/types/meal-plan";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MealPlans() {
  const [activeTab, setActiveTab] = useState("current");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<MealPlanDisplay | null>(null);
  const [savedPlans, setSavedPlans] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);

  // Load meal plans
  const loadPlans = () => {
    startTransition(async () => {
      const result = await getMealPlans({ isActive: undefined, limit: 50 });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        const plans = result.data.mealPlans;
        const active = plans.find((p: any) => p.isActive);

        // Load detailed data for active plan
        if (active) {
          const detailedResult = await getMealPlan(active.id);
          if (!detailedResult.error && detailedResult.data) {
            setCurrentPlan(detailedResult.data);
          }
        }

        setSavedPlans(plans.filter((p: any) => !p.isActive));
      }
    });
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // Handle plan duplication
  const handleDuplicate = (planId: string) => {
    startTransition(async () => {
      const result = await duplicateMealPlan(planId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Meal plan duplicated!");
        loadPlans();
      }
    });
  };

  // Handle plan deletion
  const handleDelete = (planId: string) => {
    setPlanToDelete(planId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!planToDelete) return;

    startTransition(async () => {
      const result = await deleteMealPlan(planToDelete);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Meal plan deleted!");
        loadPlans();
        if (currentPlan?.id === planToDelete) {
          setCurrentPlan(null);
        }
      }
      setDeleteDialogOpen(false);
      setPlanToDelete(null);
    });
  };

  // Handle share link copy
  const handleCopyShareLink = (shareToken: string) => {
    const url = `${window.location.origin}/meal-plans/shared/${shareToken}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard!");
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold">Meal Plans</h2>
          <p className="text-muted-foreground">
            Create and manage your weekly meal plans
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="gap-2"
            disabled={isPending}
          >
            <Plus className="w-4 h-4" />
            Create Plan
          </Button>
        </div>
      </div>

      {/* Meal Plan Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="current">Current Plan</TabsTrigger>
          <TabsTrigger value="saved">Saved Plans ({savedPlans.length})</TabsTrigger>
        </TabsList>

        {/* Current Plan Tab */}
        <TabsContent value="current" className="space-y-6">
          {isPending && !currentPlan && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading meal plan...
              </CardContent>
            </Card>
          )}

          {!isPending && !currentPlan && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Meal Plan</h3>
                <p className="text-muted-foreground mb-4">
                  Create a new meal plan to get started
                </p>
                <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Your First Plan
                </Button>
              </CardContent>
            </Card>
          )}

          {currentPlan && (
            <>
              {/* Plan Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        {currentPlan.name}
                      </CardTitle>
                      <CardDescription>
                        {format(currentPlan.startDate, "MMM d")} -{" "}
                        {format(currentPlan.endDate, "MMM d, yyyy")}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {currentPlan.isPublic && currentPlan.shareToken && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleCopyShareLink(currentPlan.shareToken!)}
                      >
                        <Share className="w-4 h-4" />
                        Copy Share Link
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleDuplicate(currentPlan.id)}
                      disabled={isPending}
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(currentPlan.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Calendar View */}
              <MealPlanCalendar mealPlan={currentPlan} onUpdate={loadPlans} />
            </>
          )}
        </TabsContent>

        {/* Saved Plans Tab */}
        <TabsContent value="saved" className="space-y-6">
          {savedPlans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Saved Plans</h3>
                <p className="text-muted-foreground">
                  Create additional meal plans to see them here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {savedPlans.map((plan) => (
                <Card
                  key={plan.id}
                  className="hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg line-clamp-1">
                          {plan.name}
                        </CardTitle>
                        <CardDescription>
                          {format(new Date(plan.startDate), "MMM d")} -{" "}
                          {format(new Date(plan.endDate), "MMM d, yyyy")}
                        </CardDescription>
                      </div>
                      {plan.isPublic && (
                        <Badge variant="secondary" className="flex-shrink-0 ml-2">
                          Public
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {plan.targetCalories && (
                      <div className="text-center">
                        <p className="text-2xl font-medium">
                          {Math.round(plan.targetCalories)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Daily Calories Target
                        </p>
                      </div>
                    )}

                    <Separator />

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDuplicate(plan.id)}
                        disabled={isPending}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Duplicate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(plan.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Meal Plan Dialog */}
      <MealPlanForm
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={loadPlans}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this meal plan and all its meals. This
              action cannot be undone.
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
