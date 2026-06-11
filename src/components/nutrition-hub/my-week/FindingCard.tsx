"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  Sparkles,
  TrendingDown,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import type { Finding, MealContribution } from "@/lib/nutrients/week-analysis";
import type { SwapSuggestion } from "@/lib/nutrients/swap-scorer";
import {
  applySwap,
  generateGapRecipe,
  getSwapSuggestions,
} from "@/actions/nutrition-week";
import { formatNutrientAmount } from "@/components/nutrition-hub/format";

interface FindingCardProps {
  finding: Finding;
  allFindings: Finding[];
  onChanged: () => Promise<void>;
}

interface AppliedSwap {
  mealId: string;
  previousRecipeId: string;
  toTitle: string;
}

export function FindingCard({ finding, onChanged }: FindingCardProps) {
  const t = useTranslations("nutritionHub.myWeek.findings");
  const tSwaps = useTranslations("nutritionHub.myWeek.swaps");
  const tNutrients = useTranslations("nutritionHub.nutrients");

  const [suggestions, setSuggestions] = useState<SwapSuggestion[] | null>(null);
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedSwap | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateFailed, setGenerateFailed] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const nutrientName = tNutrients(`${finding.nutrient}.name`);
  const isExcess = finding.kind === "excess";
  const unit = NUTRIENT_REGISTRY[finding.nutrient].unit;
  const gapText = formatNutrientAmount(finding.weekGapAmount, unit);

  async function loadSuggestionsFor(meal: MealContribution) {
    const result = await getSwapSuggestions({
      mealId: meal.mealId,
      nutrient: finding.nutrient,
      kind: finding.kind,
    });
    setSuggestions(result.error === null ? result.data : []);
  }

  function showSuggestions(meal: MealContribution) {
    setOpenMealId(meal.mealId);
    setSuggestions(null);
    setGenerateFailed(false);
    startTransition(() => loadSuggestionsFor(meal));
  }

  function apply(suggestion: SwapSuggestion) {
    setBusy(true);
    startTransition(async () => {
      const result = await applySwap({
        mealId: suggestion.mealId,
        newRecipeId: suggestion.candidateRecipeId,
      });
      if (result.error === null) {
        setApplied({
          mealId: suggestion.mealId,
          previousRecipeId: result.data.previousRecipeId,
          toTitle: suggestion.candidateTitle,
        });
        setOpenMealId(null);
        setSuggestions(null);
        await onChanged();
      }
      setBusy(false);
    });
  }

  function undo() {
    if (!applied) return;
    setBusy(true);
    startTransition(async () => {
      await applySwap({
        mealId: applied.mealId,
        newRecipeId: applied.previousRecipeId,
      });
      setApplied(null);
      await onChanged();
      setBusy(false);
    });
  }

  function generate(meal: MealContribution) {
    setGenerating(true);
    setGenerateFailed(false);
    startTransition(async () => {
      const result = await generateGapRecipe({
        mealId: meal.mealId,
        nutrient: finding.nutrient,
        kind: finding.kind,
      });
      if (result.error === null) {
        // surface the verified recipe as a fresh suggestion for this meal;
        // even when the scorer rejects it for this slot, tell the user the
        // recipe now exists in their library (honesty over silence)
        setGeneratedTitle(result.data.title);
        await loadSuggestionsFor(meal);
      } else {
        setGenerateFailed(true);
      }
      setGenerating(false);
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 space-y-4",
        isExcess
          ? "border-brand-200 dark:border-brand-500/30"
          : "border-gold-200 dark:border-gold-500/30"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isExcess ? (
            <TriangleAlert className="w-4 h-4 text-brand-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-gold-600 dark:text-gold-400" />
          )}
          <h3 className="font-display font-bold text-lg">
            {t(isExcess ? "excessTitle" : "deficitTitle", { nutrient: nutrientName })}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(isExcess ? "excessMeta" : "deficitMeta", {
            days: finding.daysAffected,
            plannedDays: finding.plannedDays,
          })}
          {" · "}
          {t(isExcess ? "weekGapExcess" : "weekGapDeficit", { amount: gapText })}
        </p>
      </div>

      {applied && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-sage-50 dark:bg-sage-500/10 border border-sage-200 dark:border-sage-500/20 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-sage-700 dark:text-sage-300">
            <Check className="w-4 h-4" />
            {tSwaps("applied", { to: applied.toTitle })}
          </span>
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-60"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {tSwaps("undo")}
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t(isExcess ? "sourcesExcess" : "sourcesDeficit")}
        </p>
        {finding.topContributors.map((c) => (
          <div key={c.mealId} className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{c.recipeTitle}</span>
              <div className="flex items-center gap-2 shrink-0">
                {isExcess && c.share > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {t("contributorShare", { share: Math.round(c.share * 100) })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => showSuggestions(c)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {tSwaps("show")}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {openMealId === c.mealId && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                {suggestions === null ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    {tSwaps("loading")}
                  </p>
                ) : suggestions.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{tSwaps("none")}</p>
                    {generatedTitle && (
                      <p className="text-xs text-sage-600 dark:text-sage-400">
                        {tSwaps("generated", { title: generatedTitle })}
                      </p>
                    )}
                    {generateFailed && (
                      <p className="text-xs text-brand-600 dark:text-brand-400">
                        {tSwaps("generateFailed")}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={generating}
                      onClick={() => generate(c)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 dark:border-gold-500/40 px-3 py-1.5 text-xs font-medium hover:bg-gold-50 dark:hover:bg-gold-500/10 transition-colors disabled:opacity-60"
                    >
                      {generating ? (
                        <>
                          <LoaderCircle className="w-3 h-3 animate-spin" />
                          {tSwaps("generating")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          {tSwaps("generate")}
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  suggestions.map((s) => (
                    <div
                      key={s.candidateRecipeId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.candidateTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {tSwaps("closes", { pct: Math.round(s.gapClosure * 100) })}
                          {s.tradeoffs.length > 0 && (
                            <>
                              {" · "}
                              <span className="text-gold-700 dark:text-gold-400">
                                {tSwaps("tradeoffs", {
                                  nutrients: s.tradeoffs
                                    .map((n) => tNutrients(`${n}.name`))
                                    .join(", "),
                                })}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => apply(s)}
                        className="rounded-full bg-sage-600 hover:bg-sage-700 text-white px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 shrink-0"
                      >
                        {busy ? tSwaps("applying") : tSwaps("apply")}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
