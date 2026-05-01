"use client";

import { useTranslations } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { Form } from "@/components/ui/form";
import { RecipeFormIngredients } from "@/components/recipes/recipe-form/RecipeFormIngredients";
import { RecipeFormInstructions } from "@/components/recipes/recipe-form/RecipeFormInstructions";

export function Step1Ingredients() {
  const t = useTranslations("recipeModal");
  const { form, ingredientFields, instructionFields, goBack, goToNextStep } = useRecipeModal();

  return (
    <Form {...form as any}>
      <div className="flex-1 p-8 pb-24 space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <div>
          <h2 className="font-display text-3xl font-semibold mb-2">Ingredients & Steps</h2>
          <p className="text-muted-foreground text-[15px]">AI will calculate nutrition in real time</p>
        </div>

        <RecipeFormIngredients form={form} ingredientFields={ingredientFields} />

        <div className="border-t border-border/50 pt-2">
          <RecipeFormInstructions form={form} instructionFields={instructionFields} />
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 mt-auto bg-card border-t border-border p-6 flex justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          className="px-4 py-2.5 rounded-md border border-border bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          ← {t("header.back")}
        </button>
        <button
          type="button"
          onClick={goToNextStep}
          className="bg-primary text-primary-foreground rounded-md px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t("step1.next")} →
        </button>
      </div>
    </Form>
  );
}
