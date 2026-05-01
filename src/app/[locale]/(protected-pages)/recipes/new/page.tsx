"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";

export default function NewRecipePage() {
  const { openCreate } = useRecipeModal();
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(`/${locale}/recipes`);
    openCreate();
  }, []);

  return null;
}
