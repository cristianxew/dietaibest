"use client";

import { createContext, useContext, useRef, useState, useCallback, useMemo } from "react";
import type { RecipeFormData, ImportedRecipe } from "@/types/recipe";

export type ModalScreen =
  | "entry"
  | "loading"
  | "preview"
  | "step0"
  | "step1"
  | "step2"
  | "success";

export type EnteredVia = "import" | "manual" | "edit";

export const STEPPER_CONFIG = [
  { id: "step0", label: "details", fields: ["title", "servings"] as (keyof RecipeFormData)[] },
  { id: "step1", label: "ingredients", fields: ["ingredients", "instructions"] as (keyof RecipeFormData)[] },
  { id: "step2", label: "nutrition", fields: [] as (keyof RecipeFormData)[] },
] as const;

export function currentStepIndex(screen: ModalScreen): number {
  return STEPPER_CONFIG.findIndex(s => s.id === screen);
}

export function nextStep(current: ModalScreen): ModalScreen | null {
  const idx = currentStepIndex(current);
  if (idx >= 0 && idx < STEPPER_CONFIG.length - 1) {
    return STEPPER_CONFIG[idx + 1].id as ModalScreen;
  }
  return null;
}

export function prevStep(current: ModalScreen): ModalScreen | null {
  const idx = currentStepIndex(current);
  if (idx > 0) {
    return STEPPER_CONFIG[idx - 1].id as ModalScreen;
  }
  return null;
}

export function previousScreen(
  current: ModalScreen,
  mode: "create" | "edit",
  enteredVia: EnteredVia
): ModalScreen | null {
  if (current === "entry") return null;
  if (current === "loading" || current === "preview") return "entry";
  if (current === "step0") {
    if (mode === "edit") return null;
    if (enteredVia === "import") return "preview";
    return "entry";
  }
  return prevStep(current);
}

export function validationFieldsFor(screen: ModalScreen): (keyof RecipeFormData)[] {
  const step = STEPPER_CONFIG.find(s => s.id === screen);
  return step ? [...step.fields] : [];
}

export interface RecipeFlowCtx {
  isOpen: boolean;
  screen: ModalScreen;
  mode: "create" | "edit";
  enteredVia: EnteredVia;
  recipeId: string | null;
  importedPreview: ImportedRecipe | null;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  openCreate: () => void;
  openEdit: (recipeId: string, data: RecipeFormData) => void;
  close: () => void;
  goToScreen: (screen: ModalScreen) => void;
  goBack: () => void;
  goToNextStep: () => Promise<void>;
  setImportedPreview: (data: ImportedRecipe) => void;
}

export interface UseRecipeFlowStateOpts {
  onResetForm: () => void;
  onResetFormWithData: (data: RecipeFormData) => void;
  validateScreen: (screen: ModalScreen) => Promise<boolean>;
}

const RecipeFlowContext = createContext<RecipeFlowCtx | null>(null);

export function useRecipeFlow(): RecipeFlowCtx {
  const ctx = useContext(RecipeFlowContext);
  if (!ctx) throw new Error("useRecipeFlow must be used within RecipeModalProvider");
  return ctx;
}

export { RecipeFlowContext };

export function useRecipeFlowState(opts: UseRecipeFlowStateOpts): RecipeFlowCtx {
  const { onResetForm, onResetFormWithData, validateScreen } = opts;

  const [isOpen, setIsOpen] = useState(false);
  const [screen, setScreen] = useState<ModalScreen>("entry");
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [importedPreview, setImportedPreviewState] = useState<ImportedRecipe | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // enteredVia derives from mode + importedPreview — no need to store separately
  const enteredVia = useMemo<EnteredVia>(() => {
    if (mode === "edit") return "edit";
    if (importedPreview !== null) return "import";
    return "manual";
  }, [mode, importedPreview]);

  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, []);

  const goToScreen = useCallback((nextScreen: ModalScreen) => {
    setScreen(nextScreen);
    setTimeout(scrollToTop, 50);
  }, [scrollToTop]);

  const openCreate = useCallback(() => {
    onResetForm();
    setImportedPreviewState(null);
    setMode("create");
    setRecipeId(null);
    setScreen("entry");
    setIsOpen(true);
  }, [onResetForm]);

  const openEdit = useCallback((id: string, data: RecipeFormData) => {
    onResetFormWithData(data);
    setMode("edit");
    setRecipeId(id);
    setImportedPreviewState(null);
    setScreen("step0");
    setIsOpen(true);
  }, [onResetFormWithData]);

  const close = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      setScreen("entry");
      onResetForm();
      setImportedPreviewState(null);
      setMode("create");
      setRecipeId(null);
    }, 300);
  }, [onResetForm]);

  const goBack = useCallback(() => {
    const prev = previousScreen(screen, mode, enteredVia);
    if (prev) {
      goToScreen(prev);
    } else {
      close();
    }
  }, [screen, mode, enteredVia, close, goToScreen]);

  const goToNextStep = useCallback(async () => {
    const valid = await validateScreen(screen);
    if (!valid) return;
    const next = nextStep(screen);
    if (next) goToScreen(next);
  }, [screen, validateScreen, goToScreen]);

  const setImportedPreview = useCallback((data: ImportedRecipe) => {
    setImportedPreviewState(data);
  }, []);

  return {
    isOpen,
    screen,
    mode,
    enteredVia,
    recipeId,
    importedPreview,
    scrollContainerRef,
    openCreate,
    openEdit,
    close,
    goToScreen,
    goBack,
    goToNextStep,
    setImportedPreview,
  };
}
