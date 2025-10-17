"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mealPlanFormSchema, type MealPlanFormData } from "@/types/meal-plan";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { createMealPlan, updateMealPlan } from "@/actions/meal-plan";

interface MealPlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editMode?: boolean;
  planId?: string;
  defaultValues?: Partial<MealPlanFormData>;
}

export function MealPlanForm({
  open,
  onOpenChange,
  onSuccess,
  editMode = false,
  planId,
  defaultValues,
}: MealPlanFormProps) {
  const [isPending, startTransition] = useTransition();
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<MealPlanFormData>({
    resolver: zodResolver(mealPlanFormSchema),
    defaultValues: defaultValues || {
      name: "",
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      isActive: false,
      isPublic: false,
    },
  });

  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const isActive = watch("isActive");
  const isPublic = watch("isPublic");

  const onSubmit = (data: MealPlanFormData) => {
    startTransition(async () => {
      const result = editMode && planId
        ? await updateMealPlan(planId, data)
        : await createMealPlan(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          editMode ? "Meal plan updated!" : "Meal plan created!"
        );
        reset();
        onOpenChange(false);
        onSuccess?.();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editMode ? "Edit Meal Plan" : "Create New Meal Plan"}
          </DialogTitle>
          <DialogDescription>
            {editMode
              ? "Update your meal plan settings"
              : "Set up a new meal plan with your nutrition goals"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Plan Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Plan Name</Label>
            <Input
              id="name"
              placeholder="e.g., Healthy Weight Loss Week 1"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      if (date) {
                        setValue("startDate", date);
                        setStartDateOpen(false);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.startDate && (
                <p className="text-sm text-destructive">
                  {errors.startDate.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => {
                      if (date) {
                        setValue("endDate", date);
                        setEndDateOpen(false);
                      }
                    }}
                    disabled={(date) => date < startDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.endDate && (
                <p className="text-sm text-destructive">
                  {errors.endDate.message}
                </p>
              )}
            </div>
          </div>

          {/* Macro Targets */}
          <div className="space-y-3">
            <Label>Daily Macro Targets (Optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="targetCalories" className="text-xs text-muted-foreground">
                  Calories
                </Label>
                <Input
                  id="targetCalories"
                  type="number"
                  placeholder="2000"
                  {...register("targetCalories", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="targetProtein" className="text-xs text-muted-foreground">
                  Protein (g)
                </Label>
                <Input
                  id="targetProtein"
                  type="number"
                  placeholder="150"
                  {...register("targetProtein", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="targetCarbs" className="text-xs text-muted-foreground">
                  Carbs (g)
                </Label>
                <Input
                  id="targetCarbs"
                  type="number"
                  placeholder="200"
                  {...register("targetCarbs", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="targetFat" className="text-xs text-muted-foreground">
                  Fat (g)
                </Label>
                <Input
                  id="targetFat"
                  type="number"
                  placeholder="65"
                  {...register("targetFat", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Set as Active Plan</Label>
                <p className="text-xs text-muted-foreground">
                  Only one plan can be active at a time
                </p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue("isActive", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic">Make Public</Label>
                <p className="text-xs text-muted-foreground">
                  Generate a shareable link
                </p>
              </div>
              <Switch
                id="isPublic"
                checked={isPublic}
                onCheckedChange={(checked) => setValue("isPublic", checked)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending}>
              {isPending
                ? "Saving..."
                : editMode
                ? "Update Plan"
                : "Create Plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
