"use client";

import {
  useForm,
  type SubmitHandler,
  type DefaultValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  mealPlanTemplateFormSchema,
  type MealPlanTemplateFormData,
  type MealPlanTemplateFormInput,
  MEAL_SLOT_PRESETS,
} from "@/types/meal-plan";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useTransition, useEffect } from "react";
import {
  createMealPlan,
  updateMealPlan,
  getMealPlans,
} from "@/actions/meal-plan";
import { useTranslations } from "next-intl";
import { usePaywall } from "@/components/billing/PaywallProvider";

interface MealPlanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (createdTemplateId?: string) => void;
  editMode?: boolean;
  planId?: string;
  defaultValues?: Partial<MealPlanTemplateFormData>;
}

type TemplateSummary = {
  id: string;
  name: string;
  duration: number;
};

export function MealPlanForm({
  open,
  onOpenChange,
  onSuccess,
  editMode = false,
  planId,
  defaultValues,
}: MealPlanFormProps) {
  const t = useTranslations();
  const paywall = usePaywall();
  const [isPending, startTransition] = useTransition();
  const [availablePlans, setAvailablePlans] = useState<
    Array<{ id: string; name: string; duration: number }>
  >([]);
  const defaultFormValues: DefaultValues<MealPlanTemplateFormInput> = {
    name: "",
    duration: 7,
    mealSlots: ["breakfast", "lunch", "dinner"],
    isPublic: false,
    ...(defaultValues as Partial<MealPlanTemplateFormInput>),
  };
  const initialMealSlots = defaultFormValues.mealSlots ?? [
    "breakfast",
    "lunch",
    "dinner",
  ];

  const [selectedMealCount, setSelectedMealCount] = useState<number>(
    initialMealSlots.length
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<MealPlanTemplateFormInput, undefined, MealPlanTemplateFormData>({
    resolver: zodResolver(mealPlanTemplateFormSchema),
    defaultValues: defaultFormValues,
  });

  const duration = watch("duration");
  const isPublic = watch("isPublic");
  const templateId = watch("templateId");

  // Load available meal plan templates for template selection
  useEffect(() => {
    if (open && !editMode) {
      startTransition(async () => {
        const result = await getMealPlans({ page: 1, limit: 50 });
        if (result.data) {
          const templates = (result.data.templates ?? []) as TemplateSummary[];

          setAvailablePlans(
            templates.map((template) => ({
              id: template.id,
              name: template.name,
              duration: template.duration,
            }))
          );
        }
      });
    }
  }, [open, editMode]);

  // Handle meal count selection
  const handleMealCountChange = (count: string) => {
    const countNum = parseInt(count);
    setSelectedMealCount(countNum);
    const preset = MEAL_SLOT_PRESETS.find((p) => p.count === countNum);
    if (preset) {
      setValue("mealSlots", preset.slots);
    }
  };

  // Handle duration slider change
  const handleDurationChange = (value: number[]) => {
    setValue("duration", value[0]);
  };

  const onSubmit: SubmitHandler<MealPlanTemplateFormData> = (data) => {
    startTransition(async () => {
      const result =
        editMode && planId
          ? await updateMealPlan(planId, data)
          : await createMealPlan(data);

      if (result.error) {
        if (typeof result.error === "string") {
          toast.error(result.error);
        } else {
          paywall.open(result.error);
        }
      } else {
        toast.success(editMode ? "Meal plan updated!" : "Meal plan created!");
        reset();
        onOpenChange(false);
        // Pass the created meal plan ID to onSuccess callback (only for new meal plans)
        onSuccess?.(editMode ? undefined : result.data?.id);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editMode ? "Edit Meal Plan" : "Create New Meal Plan"}
          </DialogTitle>
          <DialogDescription>
            {editMode
              ? "Update your meal plan. Changes will apply to all future uses."
              : "Set up a reusable meal plan with your nutrition goals"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Meal Plan Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("mealPlans.form.name")}</Label>
            <Input
              id="name"
              placeholder="e.g., Healthy Weight Loss Plan"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Give your meal plan a memorable name you can reuse
            </p>
          </div>

          {/* Meal Plan Selection - Only for create mode */}
          {!editMode && availablePlans.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="templateId">
                {t("mealPlans.form.createFromTemplate")}
              </Label>
              <Select
                value={templateId || "none"}
                onValueChange={(value) => {
                  const newTemplateId = value === "none" ? undefined : value;
                  setValue("templateId", newTemplateId);

                  // If a template is selected, update duration to match
                  if (newTemplateId) {
                    const selectedTemplate = availablePlans.find(
                      (p) => p.id === newTemplateId
                    );
                    if (selectedTemplate) {
                      setValue("duration", selectedTemplate.duration);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("mealPlans.form.selectTemplate")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("mealPlans.form.noTemplate")}
                  </SelectItem>
                  {availablePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.duration}{" "}
                      {plan.duration === 1
                        ? t("mealPlans.calendar.day")
                        : t("mealPlans.calendar.days")}
                      )
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("mealPlans.form.templateDescription")}
              </p>
            </div>
          )}

          {/* Duration Input with Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="duration">{t("mealPlans.form.duration")}</Label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  {duration}
                </span>
                <span className="text-sm text-muted-foreground">
                  {duration === 1
                    ? t("mealPlans.calendar.day")
                    : t("mealPlans.calendar.days")}
                </span>
              </div>
            </div>

            <Slider
              value={[duration]}
              onValueChange={handleDurationChange}
              min={1}
              max={30}
              step={1}
              className="w-full"
            />

            {/* Quick duration presets */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValue("duration", 7)}
                className={cn(duration === 7 && "border-primary")}
              >
                {t("mealPlans.form.oneWeek")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValue("duration", 14)}
                className={cn(duration === 14 && "border-primary")}
              >
                {t("mealPlans.form.twoWeeks")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValue("duration", 30)}
                className={cn(duration === 30 && "border-primary")}
              >
                {t("mealPlans.form.oneMonth")}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("mealPlans.form.scheduleHint")}
            </p>
            {errors.duration && (
              <p className="text-sm text-destructive">
                {errors.duration.message}
              </p>
            )}
          </div>

          {/* Meal Count Selection */}
          <div className="space-y-3">
            <Label>{t("mealPlans.form.mealsPerDay")}</Label>
            <RadioGroup
              value={selectedMealCount.toString()}
              onValueChange={handleMealCountChange}
              className="grid grid-cols-1 gap-2"
            >
              {MEAL_SLOT_PRESETS.map((preset) => (
                <div key={preset.count} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={preset.count.toString()}
                    id={`meal-count-${preset.count}`}
                  />
                  <Label
                    htmlFor={`meal-count-${preset.count}`}
                    className="font-normal cursor-pointer flex-1"
                  >
                    {t(preset.label)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {t("mealPlans.form.mealCountDescription")}
            </p>
          </div>

          {/* Macro Targets */}
          <div className="space-y-3">
            <Label>Daily Macro Targets (Optional)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="targetCalories"
                  className="text-xs text-muted-foreground"
                >
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
                <Label
                  htmlFor="targetProtein"
                  className="text-xs text-muted-foreground"
                >
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
                <Label
                  htmlFor="targetCarbs"
                  className="text-xs text-muted-foreground"
                >
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
                <Label
                  htmlFor="targetFat"
                  className="text-xs text-muted-foreground"
                >
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
            <p className="text-xs text-muted-foreground">
              Set target macros to help you stay on track with your nutrition
              goals
            </p>
          </div>

          {/* Settings */}
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isPublic">{t("mealPlans.form.makePublic")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("mealPlans.form.generateShareLink")}
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
                ? "Update Meal Plan"
                : "Create Meal Plan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
