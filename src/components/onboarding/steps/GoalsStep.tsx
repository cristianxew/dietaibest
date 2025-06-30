"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useOnboardingState } from "../hooks/useOnboardingState";
import { NavigationButtons } from "../components/NavigationButtons";
import { DIETARY_GOALS, type GoalsData } from "@/types/onboarding";
import { useTranslations } from "next-intl";
import { calculateMacros } from "@/utils/macroCalculator";
import { cn } from "@/lib/utils";

// Form schema
const formSchema = z.object({
  dietaryGoal: z.enum(["lose", "maintain", "gain"], {
    required_error: "Please select a dietary goal",
  }),
});

interface MacroDisplayProps {
  label: string;
  value: number;
  unit: string;
  percentage?: number;
  color: string;
}

function MacroDisplay({
  label,
  value,
  unit,
  percentage,
  color,
}: MacroDisplayProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-lg font-semibold">
          {value}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {unit}
          </span>
        </span>
      </div>
      {percentage !== undefined && (
        <Progress
          value={percentage}
          className="h-2"
          style={{ "--progress-color": color } as React.CSSProperties}
        />
      )}
    </div>
  );
}

export function GoalsStep() {
  const t = useTranslations("onboarding");
  const { state, setGoals, setStep } = useOnboardingState();
  const [macros, setMacros] = useState<GoalsData | null>(state.goals);
  const [isCalculating, setIsCalculating] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange", // Enable real-time validation
    defaultValues: state.goals
      ? {
          dietaryGoal: state.goals.dietaryGoal,
        }
      : {
          dietaryGoal: undefined,
        },
  });

  const dietaryGoal = form.watch("dietaryGoal");

  // Calculate macros when goal changes
  useEffect(() => {
    if (!state.demographics || !dietaryGoal) return;

    setIsCalculating(true);

    // Simulate API call delay
    const timer = setTimeout(() => {
      const calculatedMacros = calculateMacros({
        dateOfBirth: new Date(state.demographics!.dateOfBirth),
        gender: state.demographics!.gender,
        heightCm: state.demographics!.heightCm,
        weightKg: state.demographics!.weightKg,
        activityLevel: state.demographics!.activityLevel,
        dietaryGoal: dietaryGoal,
      });

      setMacros({
        dietaryGoal,
        ...calculatedMacros,
      });
      setIsCalculating(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [dietaryGoal, state.demographics]);

  const onSubmit = () => {
    if (!macros) return;

    setGoals(macros);
    setStep(2); // Move to next step
  };

  const handleBack = () => {
    setStep(0);
  };

  // Calculate macro percentages
  const totalCalories = macros?.dailyCalories || 0;
  const proteinCalories = (macros?.proteinGrams || 0) * 4;
  const carbsCalories = (macros?.carbsGrams || 0) * 4;
  const fatCalories = (macros?.fatGrams || 0) * 9;

  const proteinPercentage =
    totalCalories > 0 ? (proteinCalories / totalCalories) * 100 : 0;
  const carbsPercentage =
    totalCalories > 0 ? (carbsCalories / totalCalories) * 100 : 0;
  const fatPercentage =
    totalCalories > 0 ? (fatCalories / totalCalories) * 100 : 0;

  const getGoalIcon = (goal: string) => {
    switch (goal) {
      case "lose":
        return <TrendingDown className="h-5 w-5" />;
      case "gain":
        return <TrendingUp className="h-5 w-5" />;
      default:
        return <Target className="h-5 w-5" />;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Dietary Goal Selection */}
        <FormField
          control={form.control}
          name="dietaryGoal"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>{t("steps.goals.dietaryGoal")}</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                >
                  {DIETARY_GOALS.map((goal) => (
                    <FormItem key={goal.value}>
                      <FormControl>
                        <RadioGroupItem
                          value={goal.value}
                          id={goal.value}
                          className="peer sr-only"
                        />
                      </FormControl>
                      <FormLabel
                        htmlFor={goal.value}
                        className={cn(
                          "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        )}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          {getGoalIcon(goal.value)}
                          <span className="font-semibold">{goal.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground text-center">
                          {goal.description}
                        </span>
                      </FormLabel>
                    </FormItem>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Macro Preview */}
        {macros && (
          <Card
            className={cn(
              "transition-opacity duration-300",
              isCalculating ? "opacity-50" : "opacity-100"
            )}
          >
            <CardHeader>
              <CardTitle>{t("steps.goals.macroPreview")}</CardTitle>
              <CardDescription>Based on your profile and goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Daily Calories */}
              <div className="text-center py-4 border-b">
                <p className="text-3xl font-bold">{macros.dailyCalories}</p>
                <p className="text-sm text-muted-foreground">Daily Calories</p>
              </div>

              {/* Macros Breakdown */}
              <div className="space-y-4">
                <MacroDisplay
                  label="Protein"
                  value={macros.proteinGrams}
                  unit="g"
                  percentage={proteinPercentage}
                  color="#3b82f6"
                />
                <MacroDisplay
                  label="Carbohydrates"
                  value={macros.carbsGrams}
                  unit="g"
                  percentage={carbsPercentage}
                  color="#10b981"
                />
                <MacroDisplay
                  label="Fat"
                  value={macros.fatGrams}
                  unit="g"
                  percentage={fatPercentage}
                  color="#f59e0b"
                />
              </div>

              {/* Macro Percentages Summary */}
              <div className="pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Macro Split:</span>
                  <span className="font-medium">
                    {Math.round(proteinPercentage)}% /{" "}
                    {Math.round(carbsPercentage)}% / {Math.round(fatPercentage)}
                    %
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <NavigationButtons
          currentStep={1}
          totalSteps={3}
          onBack={handleBack}
          onNext={form.handleSubmit(onSubmit)}
          canGoNext={form.formState.isValid && !!macros}
        />
      </form>
    </Form>
  );
}
