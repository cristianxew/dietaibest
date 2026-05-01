"use client";

import { RecipeModalContext, useRecipeModalState } from "@/hooks/use-recipe-modal";
import { RecipeModal } from "@/components/recipes/modal/RecipeModal";

export function RecipeModalProvider({ children }: { children: React.ReactNode }) {
  const ctx = useRecipeModalState();
  return (
    <RecipeModalContext.Provider value={ctx}>
      {children}
      <RecipeModal />
    </RecipeModalContext.Provider>
  );
}
