"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ProgressIndicatorProps {
  currentStep: number;
  steps: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
  onStepClick?: (stepIndex: number) => void;
  canNavigateToStep?: (stepIndex: number) => boolean;
}

export function ProgressIndicator({
  currentStep,
  steps,
  onStepClick,
  canNavigateToStep,
}: ProgressIndicatorProps) {
  return (
    <div className="w-full px-4 py-6">
      <div className="relative">
        {/* Progress bar background */}
        <div className="absolute left-0 top-6 h-0.5 w-full bg-muted" />

        {/* Active progress bar */}
        <div
          className="absolute left-0 top-6 h-0.5 bg-primary transition-all duration-300 ease-out"
          style={{
            width: `${(currentStep / (steps.length - 1)) * 100}%`,
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const canNavigate = canNavigateToStep
              ? canNavigateToStep(index)
              : isCompleted;

            return (
              <div key={step.id} className="flex flex-col items-center">
                <button
                  type="button"
                  className={cn(
                    "relative flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-200",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isCurrent &&
                      "border-primary bg-background text-primary shadow-lg",
                    !isCompleted &&
                      !isCurrent &&
                      "border-muted bg-background text-muted-foreground",
                    canNavigate && "cursor-pointer hover:scale-110",
                    !canNavigate && "cursor-not-allowed"
                  )}
                  onClick={() => canNavigate && onStepClick?.(index)}
                  disabled={!canNavigate}
                  aria-label={`Go to ${step.title}`}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </button>

                <div className="mt-3 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isCurrent && "text-foreground",
                      !isCurrent && "text-muted-foreground"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && isCurrent && (
                    <p className="mt-1 text-xs text-muted-foreground max-w-[150px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
