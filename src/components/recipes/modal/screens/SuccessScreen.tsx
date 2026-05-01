"use client";

import { useTranslations } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

export function SuccessScreen() {
  const t = useTranslations("recipeModal.success");
  const { close, savedRecipeId, form, openCreate } = useRecipeModal();
  const router = useRouter();
  const locale = useLocale();

  const { calories, protein, carbs } = form.getValues();

  const handleView = () => {
    close();
    if (savedRecipeId) {
      router.push(`/${locale}/recipes/${savedRecipeId}`);
      router.refresh();
    } else {
      router.push(`/${locale}/recipes`);
      router.refresh();
    }
  };

  const handleAddAnother = () => {
    router.refresh();
    openCreate();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="text-center max-w-sm">
        {/* Checkmark */}
        <div className="w-16 h-16 rounded-full bg-sage-50 border-2 border-sage-400 flex items-center justify-center mx-auto mb-5 animate-in zoom-in-50 duration-300">
          <Check className="w-7 h-7 text-sage-600" strokeWidth={2.5} />
        </div>

        <h2 className="font-display text-2xl font-bold text-foreground mb-2">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          {form.getValues("title")}
        </p>

        {/* Macro pills */}
        {(calories || protein || carbs) && (
          <div className="flex justify-center gap-1.5 mb-7">
            {calories && (
              <span className="px-3 py-1 rounded-full bg-muted border border-border text-xs font-semibold text-primary">
                {calories} kcal
              </span>
            )}
            {protein && (
              <span className="px-3 py-1 rounded-full bg-muted border border-border text-xs font-semibold text-sage-500">
                {protein}g protein
              </span>
            )}
            {carbs && (
              <span className="px-3 py-1 rounded-full bg-muted border border-border text-xs font-semibold text-amber-500">
                {carbs}g carbs
              </span>
            )}
          </div>
        )}

        {!calories && !protein && !carbs && <div className="mb-7" />}

        <button
          onClick={handleView}
          className="bg-primary text-primary-foreground rounded-xl px-7 py-3 text-sm font-semibold hover:opacity-90 transition-opacity block mx-auto mb-3"
        >
          {t("view")} →
        </button>
        <button
          onClick={handleAddAnother}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t("addAnother")}
        </button>
      </div>
    </div>
  );
}
