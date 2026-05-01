"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { RecipeModalStepper } from "./RecipeModalStepper";
import { EntryScreen } from "./screens/EntryScreen";
import { LoadingScreen } from "./screens/LoadingScreen";
import { PreviewScreen } from "./screens/PreviewScreen";
import { Step0Details } from "./screens/Step0Details";
import { Step1Ingredients } from "./screens/Step1Ingredients";
import { Step2Nutrition } from "./screens/Step2Nutrition";
import { SuccessScreen } from "./screens/SuccessScreen";
import { X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const SHOW_BACK: Record<string, boolean> = {
  entry: false,
  loading: true,
  preview: true,
  step0: true,
  step1: true,
  step2: true,
  success: false,
};

const SHOW_STEPPER: Record<string, boolean> = {
  step0: true,
  step1: true,
  step2: true,
};

export function RecipeModal() {
  const { isOpen, screen, close, goBack, mode } = useRecipeModal();
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && screen !== "loading") {
        close();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, screen, close]);

  if (!isOpen) return null;

  const title = mode === "edit" ? "Edit Recipe" : "Add Recipe";
  const showBack = SHOW_BACK[screen] ?? false;
  const showStepper = SHOW_STEPPER[screen] ?? false;

  return createPortal(
    <div className="fixed inset-0 z-[500]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[6px]"
        onClick={screen !== "loading" ? close : undefined}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative flex items-center justify-center w-full h-full p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "pointer-events-auto bg-card",
            "w-[min(1024px,96vw)] h-[min(800px,96vh)]",
            "rounded-[20px] flex flex-col overflow-hidden",
            "shadow-2xl border border-border",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border bg-muted/40 dark:bg-muted/60 flex-shrink-0 gap-3">
            {/* Left: Back button */}
            <div className="w-20">
              {showBack ? (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              ) : (
                !showStepper && (
                  <span className="text-sm font-semibold text-foreground">
                    {title}
                  </span>
                )
              )}
            </div>

            {/* Center: Stepper or title */}
            <div className="flex-1 flex justify-center">
              {showStepper && <RecipeModalStepper />}
            </div>

            {/* Right: Close button */}
            <div className="w-20 flex justify-end">
              <button
                onClick={close}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <ModalContent />
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalContent() {
  const { screen, scrollContainerRef } = useRecipeModal();

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-border flex flex-col"
    >
      {screen === "entry" && <EntryScreen />}
      {screen === "loading" && <LoadingScreen />}
      {screen === "preview" && <PreviewScreen />}
      {screen === "step0" && <Step0Details />}
      {screen === "step1" && <Step1Ingredients />}
      {screen === "step2" && <Step2Nutrition />}
      {screen === "success" && <SuccessScreen />}
    </div>
  );
}
