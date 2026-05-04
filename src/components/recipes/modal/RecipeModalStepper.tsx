"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecipeModal, STEPPER_CONFIG, currentStepIndex } from "@/hooks/use-recipe-modal";
import { useTranslations } from "next-intl";

export function RecipeModalStepper() {
  const { screen } = useRecipeModal();
  const t = useTranslations("recipeModal.stepper");
  const currentStep = currentStepIndex(screen);

  return (
    <nav aria-label="Recipe creation steps">
      <ol className="flex items-center gap-0">
        {STEPPER_CONFIG.map(({ id, label }, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;

          return (
            <li key={id} className="flex items-center">
              {/* Dot + label */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-[32px] h-[32px] rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-300",
                    isCompleted && "bg-sage-500 border-sage-500 text-white",
                    isActive && "bg-primary border-primary text-primary-foreground",
                    isPending && "border-border text-muted-foreground bg-transparent"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium leading-none",
                    isActive && "text-primary",
                    isCompleted && "text-sage-500",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {t(label)}
                </span>
              </div>

              {/* Connector line (not after last item) */}
              {index < STEPPER_CONFIG.length - 1 && (
                <div
                  className={cn(
                    "w-11 h-0.5 mx-1.5 mb-3.5 transition-all duration-400",
                    index < currentStep ? "bg-sage-500" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
