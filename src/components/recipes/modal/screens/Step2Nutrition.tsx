"use client";

import { useTranslations } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { useRecipeForm } from "@/hooks/use-recipe-form";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Form,
} from "@/components/ui/form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Check, RefreshCw, Calculator, LockKeyhole, Globe } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useEntitlements } from "@/hooks/useEntitlements";
import { usePaywall } from "@/components/billing/PaywallProvider";
import { ProBadge } from "@/components/billing/ProBadge";
import { MICRONUTRIENT_GROUPS } from "@/lib/nutrition-fields";

const MACRO_TILES = [
  { key: "calories" as const, unit: "kcal", accent: "brand" },
  { key: "protein" as const, unit: "g", accent: "sage" },
  { key: "carbs" as const, unit: "g", accent: "gold" },
  { key: "fat" as const, unit: "g", accent: "neutral" },
  { key: "fiber" as const, unit: "g", accent: "sage" },
];

const ACCENT_TEXT_CLASSES: Record<string, string> = {
  brand: "text-primary",
  sage: "text-sage-600 dark:text-sage-400",
  gold: "text-amber-600 dark:text-amber-400",
  neutral: "text-foreground",
};

export function Step2Nutrition() {
  const t = useTranslations("recipeModal");
  const tBilling = useTranslations("billing");
  const { goBack } = useRecipeModal();
  const {
    form,
    analyzeNutrition,
    nutritionLoading,
    nutritionResult,
    handleSubmit,
    isSubmitting,
  } = useRecipeForm();
  const { status: entStatus, data: entData } = useEntitlements();
  const paywall = usePaywall();

  const analyzed = Boolean(nutritionResult);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const control = form.control as any;

  const isPro = entStatus === "ready" && entData?.isPro;
  const quotaLimit = entData?.limits?.edamamAnalysesPerMonth ?? null;
  const quotaUsed = entData?.usage?.edamamAnalysesPerMonth ?? 0;
  const quotaExhausted = !isPro && quotaLimit !== null && quotaUsed >= quotaLimit;

  const handleAnalyzeClick = () => {
    if (quotaExhausted) {
      paywall.open({
        code: "QUOTA_EXCEEDED",
        quota: "edamamAnalysesPerMonth",
        limit: quotaLimit!,
        used: quotaUsed,
      });
      return;
    }
    analyzeNutrition();
  };

  return (
    <Form {...form as any}>
      <div className="flex-1 p-8 pb-28 space-y-8 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="font-display text-3xl font-semibold">Nutrition</h2>
            {!isPro && entStatus === "ready" && <ProBadge />}
          </div>
          <p className="text-muted-foreground text-[15px]">Review and adjust nutritional values for your recipe</p>
        </div>

        {/* Auto-analyze banner */}
        <div
          className={cn(
            "rounded-xl border p-4",
            analyzed
              ? "bg-sage-500/5 border-sage-500/30"
              : "bg-card border-border"
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {analyzed ? (
                <Check className="w-5 h-5 text-sage-500" />
              ) : (
                <Calculator className="w-5 h-5 text-primary" />
              )}
              <div>
                <p className={cn("text-[15px] font-semibold leading-tight", analyzed ? "text-sage-500" : "text-foreground")}>
                  {analyzed ? t("step2.analyzed") : t("step2.analyzeTitle")}
                </p>
                <p className="text-[13px] text-muted-foreground mt-0.5">
                  {analyzed
                    ? t("step2.analyzeDescription")
                    : quotaExhausted
                      ? t("step2.quotaExhausted")
                      : !isPro && quotaLimit !== null
                        ? t("step2.remaining", { remaining: quotaLimit - quotaUsed, limit: quotaLimit })
                        : t("step2.analyzeDescription")
                  }
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAnalyzeClick}
              disabled={nutritionLoading}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md transition-all border",
                quotaExhausted && !analyzed
                  ? "border-border/50 text-muted-foreground bg-muted/30 cursor-not-allowed"
                  : analyzed
                    ? "border-sage-500/30 text-sage-500 hover:bg-sage-500/10 bg-transparent"
                    : "bg-transparent border-border hover:bg-muted text-foreground",
                nutritionLoading && "opacity-60 cursor-not-allowed"
              )}
            >
              {nutritionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t("step2.analyzing")}
                </>
              ) : quotaExhausted && !analyzed ? (
                <>
                  <LockKeyhole className="w-4 h-4" />
                  {tBilling("upgradeButton")}
                </>
              ) : analyzed ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  {t("step2.recalculate")}
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  {t("step2.analyzeButton")}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Macro tiles grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {MACRO_TILES.map(({ key, unit, accent }) => {
            const textColor = ACCENT_TEXT_CLASSES[accent];
            return (
              <div
                key={key}
                className="rounded-xl border border-border bg-card p-4 pb-5 flex flex-col items-center justify-center relative shadow-sm"
              >
                <FormField
                  control={control}
                  name={key}
                  render={({ field }) => (
                    <FormItem className="w-full text-center space-y-0">
                      <FormControl>
                        <input
                          type="number"
                          min={0}
                          step={key === "calories" ? 1 : 0.1}
                          placeholder="0"
                          className={cn(
                            "w-full bg-transparent border-none outline-none text-center text-[28px] font-display font-semibold mb-1",
                            textColor,
                            "placeholder:text-muted-foreground/30"
                          )}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )
                          }
                          disabled={nutritionLoading}
                        />
                      </FormControl>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[13px] font-medium text-foreground capitalize leading-none">
                          {key === "calories" ? "Calories" : key}
                        </span>
                        <span className="text-[11px] text-muted-foreground leading-none">
                          {unit}
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>

        {/* Micronutrients accordion */}
        <Accordion type="single" collapsible className="w-full border border-border rounded-xl bg-card shadow-sm overflow-hidden">
          <AccordionItem value="micro" className="border-none">
            <AccordionTrigger className="px-5 py-4 hover:no-underline [&[data-state=open]>svg]:hidden bg-muted/40 dark:bg-muted/60 border-b border-border/50">
              <div className="flex items-center gap-3">
                <span className="text-base font-semibold text-foreground">Micronutrients</span>
                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-secondary/50 text-muted-foreground border border-border/50">
                  Optional
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-5 pb-6">
              <div className="space-y-8">
                {MICRONUTRIENT_GROUPS.map((group) => (
                  <div key={group.title}>
                    <h5 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase mb-4">
                      {group.title}
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {group.fields.map((field) => (
                        <FormField
                          key={field.key}
                          control={control}
                          name={field.key}
                          render={({ field: formField }) => (
                            <FormItem className="space-y-1.5">
                              <div className="text-[13px] text-muted-foreground">
                                {field.label}
                              </div>
                              <FormControl>
                                <div className="relative flex items-center h-[42px] rounded-md border border-border bg-secondary/20 overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.1}
                                    placeholder="—"
                                    className="flex-1 w-full bg-transparent px-3 py-2 text-sm outline-none text-right placeholder:text-muted-foreground/40 text-foreground"
                                    value={formField.value ?? ""}
                                    onChange={(e) =>
                                      formField.onChange(
                                        e.target.value ? parseFloat(e.target.value) : undefined
                                      )
                                    }
                                  />
                                  <div className="h-full px-3 flex items-center justify-center border-l border-border bg-secondary/40 text-xs text-muted-foreground min-w-[40px]">
                                    {field.unit}
                                  </div>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Make public toggle */}
        <FormField
          control={control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5"
                />
              </FormControl>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                  <Globe className="w-4 h-4 text-primary" />
                  {t("step2.makePublic")}
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {t("step2.makePublicHint")}
                </p>
              </div>
            </FormItem>
          )}
        />
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
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground rounded-md px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          {isSubmitting ? t("step2.saving") : (
            <>
              <Check className="w-4 h-4" />
              Save Recipe
            </>
          )}
        </button>
      </div>
    </Form>
  );
}
