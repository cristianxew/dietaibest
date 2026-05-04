"use client";

import { useTranslations } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { useRecipeForm } from "@/hooks/use-recipe-form";
import { Clock, Users, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function PreviewScreen() {
  const t = useTranslations("recipeModal");
  const { importedPreview, goToScreen } = useRecipeModal();
  const { handleSubmit, isSubmitting } = useRecipeForm();

  if (!importedPreview) return null;

  const totalTime = (importedPreview.prepTime || 0) + (importedPreview.cookTime || 0);

  const macros = [
    { key: "kcal", label: "Kcal", value: importedPreview.calories, color: "text-primary" },
    { key: "protein", label: "Protein", value: importedPreview.protein ? `${importedPreview.protein}g` : null, color: "text-sage-500" },
    { key: "carbs", label: "Carbs", value: importedPreview.carbs ? `${importedPreview.carbs}g` : null, color: "text-amber-500" },
    { key: "fat", label: "Fat", value: importedPreview.fat ? `${importedPreview.fat}g` : null, color: "text-muted-foreground" },
    { key: "fiber", label: "Fiber", value: importedPreview.fiber ? `${importedPreview.fiber}g` : null, color: "text-sage-400" },
  ].filter(m => m.value);

  const handleSaveAsIs = async () => {
    await handleSubmit();
  };

  const handleEditFirst = () => {
    goToScreen("step0");
  };

  return (
    <div className="p-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
      {/* Extracted badge */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-1.5 h-1.5 rounded-full bg-sage-500" />
        <span className="text-[11px] font-bold text-sage-600 uppercase tracking-wider">
          {t("preview.extracted")}
        </span>
      </div>

      <h2 className="font-display text-xl font-bold text-foreground mb-1">
        {importedPreview.title}
      </h2>
      {importedPreview.sourceUrl && (
        <p className="text-xs text-muted-foreground mb-5">
          {t("preview.extracted")}: {importedPreview.sourceUrl}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-5">
        {/* Left: recipe details */}
        <div>
          {/* Stats row */}
          {(totalTime > 0 || importedPreview.servings) && (
            <div className="flex gap-2 mb-4">
              {totalTime > 0 && (
                <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{totalTime} min</p>
                    <p className="text-[10px] text-muted-foreground">{t("preview.totalTime")}</p>
                  </div>
                </div>
              )}
              {importedPreview.servings && (
                <div className="flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{importedPreview.servings}</p>
                    <p className="text-[10px] text-muted-foreground">{t("preview.servings")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nutrition strip */}
          {macros.length > 0 && (
            <div className="flex gap-1.5 mb-4">
              {macros.map((m) => (
                <div
                  key={m.key}
                  className="flex-1 bg-card border border-border rounded-xl p-2 text-center"
                >
                  <p className={cn("text-sm font-bold mb-0.5", m.color)}>
                    {m.value}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Ingredients */}
          {importedPreview.ingredients.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 mb-3">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Ingredients ({importedPreview.ingredients.length})
              </h4>
              <div className="space-y-1.5">
                {importedPreview.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                    <span className="flex-1 text-foreground">{ing.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {ing.amount} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {importedPreview.instructions.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <h4 className="text-sm font-semibold text-foreground mb-3">
                Instructions
              </h4>
              <div className="space-y-2">
                {importedPreview.instructions.map((step, i) => (
                  <div key={i} className="flex gap-2.5">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-[11px] font-bold text-primary shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: actions sidebar */}
        <div>
          <div className="bg-card border border-border rounded-xl p-4 lg:sticky lg:top-0">
            <h4 className="text-sm font-semibold text-foreground mb-1.5">
              {t("preview.looksGood")}
            </h4>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              {t("preview.saveDescription")}
            </p>
            <button
              onClick={handleSaveAsIs}
              disabled={isSubmitting}
              className="w-full bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-1.5 mb-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {t("preview.save")}
            </button>
            <button
              onClick={handleEditFirst}
              className="w-full bg-transparent border border-border rounded-xl py-2.5 text-xs text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
            >
              {t("preview.editFirst")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
