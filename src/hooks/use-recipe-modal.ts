"use client";

import { useRef, useCallback } from "react";

// Re-export flow types and helpers for backward compatibility
export type { ModalScreen, EnteredVia, RecipeFlowCtx } from "./use-recipe-flow";
export {
  STEPPER_CONFIG,
  currentStepIndex,
  nextStep,
  prevStep,
  previousScreen,
  validationFieldsFor,
  RecipeFlowContext as RecipeModalContext,
  useRecipeFlow as useRecipeModal,
} from "./use-recipe-flow";

import {
  useRecipeFlowState,
  validationFieldsFor,
  firstStepWithError,
  type ModalScreen,
  type RecipeFlowCtx,
} from "./use-recipe-flow";
import { useRecipeFormState, type RecipeFormCtx } from "./use-recipe-form";
import type { RecipeFormData } from "@/types/recipe";

// RecipeModalCtx is an alias kept for backward compatibility
export type RecipeModalCtx = RecipeFlowCtx;

export function useRecipeModalState(): { modal: RecipeFlowCtx; form: RecipeFormCtx } {
  // Break the cycle (flow↔form) using stable ref-wrapped callbacks.
  // Refs are updated synchronously each render so they always hold the latest form methods.
  const resetFormRef = useRef<() => void>(() => {});
  const resetFormWithDataRef = useRef<(data: RecipeFormData) => void>(() => {});
  const validateScreenRef = useRef<(screen: ModalScreen) => Promise<boolean>>(
    async () => true
  );

  const flow = useRecipeFlowState({
    onResetForm: useCallback(() => resetFormRef.current(), []),
    onResetFormWithData: useCallback((data: RecipeFormData) => resetFormWithDataRef.current(data), []),
    validateScreen: useCallback((s: ModalScreen) => validateScreenRef.current(s), []),
  });

  const form = useRecipeFormState({
    mode: flow.mode,
    recipeId: flow.recipeId,
    isOpen: flow.isOpen,
    onSubmitSuccess: useCallback(() => flow.goToScreen("success"), [flow.goToScreen]),
    onValidationError: useCallback((errorFields: string[]) => {
      const step = firstStepWithError(errorFields);
      if (step) flow.goToScreen(step);
    }, [flow.goToScreen]),
  });

  // Wire refs to the latest form methods (synchronous during render — safe)
  resetFormRef.current = form.resetForm;
  resetFormWithDataRef.current = form.form.reset;
  validateScreenRef.current = (screen: ModalScreen) => {
    const fields = validationFieldsFor(screen);
    if (!fields.length) return Promise.resolve(true);
    return form.form.trigger(fields);
  };

  return { modal: flow, form };
}
