"use client";

import { RecipeModalContext, useRecipeModalState } from "@/hooks/use-recipe-modal";
import { RecipeFormContext } from "@/hooks/use-recipe-form";
import { RecipeModal } from "@/components/recipes/modal/RecipeModal";

export function RecipeModalProvider({ children }: { children: React.ReactNode }) {
  const { modal, form } = useRecipeModalState();
  return (
    <RecipeModalContext.Provider value={modal}>
      <RecipeFormContext.Provider value={form}>
        {children}
        <RecipeModal />
      </RecipeFormContext.Provider>
    </RecipeModalContext.Provider>
  );
}
