"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

interface NavigationButtonsProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onFinish?: () => void;
  canGoNext: boolean;
  isSubmitting?: boolean;
  backLabel?: string;
  nextLabel?: string;
  finishLabel?: string;
}

export function NavigationButtons({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onFinish,
  canGoNext,
  isSubmitting = false,
  backLabel = "Back",
  nextLabel = "Next",
  finishLabel = "Complete Setup",
}: NavigationButtonsProps) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="flex items-center justify-between pt-6">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={isFirstStep || isSubmitting}
        className="min-w-[100px]"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Button>

      {isLastStep ? (
        <Button
          type="button"
          onClick={onFinish}
          disabled={!canGoNext || isSubmitting}
          className="min-w-[150px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            finishLabel
          )}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isSubmitting}
          className="min-w-[100px]"
        >
          {nextLabel}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
