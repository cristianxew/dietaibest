"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import type { RecipeFormData } from "@/types/recipe";

interface EditRedirectShellProps {
  recipeId: string;
  locale: string;
  formData: RecipeFormData;
}

export function EditRedirectShell({ recipeId, locale, formData }: EditRedirectShellProps) {
  const { openEdit } = useRecipeModal();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${locale}/recipes/${recipeId}`);
    openEdit(recipeId, formData);
  }, []);

  return null;
}
