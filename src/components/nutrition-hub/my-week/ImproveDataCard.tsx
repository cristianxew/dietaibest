"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DatabaseZap, Check, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  matchRecipeIngredients,
  type ImproveDataItem,
} from "@/actions/nutrition-week";

export interface ImproveDataCardProps {
  items: ImproveDataItem[];
  prominent: boolean;
  onMatched: () => Promise<void>;
}

type RowState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; matched: number; total: number }
  | { status: "error"; message: string };

export function ImproveDataCard({ items, prominent, onMatched }: ImproveDataCardProps) {
  const t = useTranslations("nutritionHub.myWeek.improveData");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [, startTransition] = useTransition();

  function analyze(recipeId: string) {
    setRows((prev) => ({ ...prev, [recipeId]: { status: "working" } }));
    startTransition(async () => {
      const result = await matchRecipeIngredients({ recipeId });
      if (result.error !== null) {
        const message = typeof result.error === "string" ? result.error : "Error";
        setRows((prev) => ({ ...prev, [recipeId]: { status: "error", message } }));
        return;
      }
      setRows((prev) => ({
        ...prev,
        [recipeId]: { status: "done", ...result.data },
      }));
      await onMatched();
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 space-y-3",
        prominent ? "border-gold-300 dark:border-gold-500/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-2">
        <DatabaseZap className="w-4 h-4 text-gold-600 dark:text-gold-400" />
        <h3 className="font-display font-bold">{t("title")}</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        {t("body", { count: items.length })}
      </p>

      <ul className="space-y-2">
        {items.map((item) => {
          const state = rows[item.recipeId] ?? { status: "idle" };
          return (
            <li
              key={item.recipeId}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="truncate">{item.title}</span>
              {state.status === "done" ? (
                <span className="inline-flex items-center gap-1 text-sage-600 dark:text-sage-400 text-xs shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  {t("done", { matched: state.matched, total: state.total })}
                </span>
              ) : state.status === "error" ? (
                <span className="text-xs text-brand-600 dark:text-brand-400 shrink-0">
                  {state.message}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={state.status === "working"}
                  onClick={() => analyze(item.recipeId)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 dark:border-gold-500/40 px-3 py-1 text-xs font-medium hover:bg-gold-50 dark:hover:bg-gold-500/10 transition-colors disabled:opacity-60 shrink-0"
                >
                  {state.status === "working" ? (
                    <>
                      <LoaderCircle className="w-3 h-3 animate-spin" />
                      {t("analyzing")}
                    </>
                  ) : (
                    t("analyze")
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
