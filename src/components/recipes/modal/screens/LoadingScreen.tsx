"use client";

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";

export function LoadingScreen() {
  const t = useTranslations("recipeModal.loading");

  const steps = [
    t("step1"),
    t("step2"),
    t("step3"),
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="text-center max-w-sm w-full">
        {/* Spinner */}
        <div className="relative w-[60px] h-[60px] mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-[3px] border-border border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <h3 className="font-display text-xl font-semibold text-foreground mb-1.5">
          {t("title")}
        </h3>
        <p className="text-sm text-muted-foreground mb-6">
          {t("subtitle")}
        </p>

        {/* Step list */}
        <div className="bg-card border border-border rounded-xl p-3 flex flex-col gap-2 text-left">
          {steps.map((step, i) => (
            <div
              key={i}
              className="flex items-center gap-2.5"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <div
                className={[
                  "w-[18px] h-[18px] rounded-full shrink-0 flex items-center justify-center border-[1.5px]",
                  i === 0
                    ? "bg-sage-50 border-sage-400"
                    : i === 1
                    ? "bg-primary/10 border-primary"
                    : "bg-muted border-border",
                ].join(" ")}
              >
                {i === 0 ? (
                  <span className="text-sage-600 text-[9px]">✓</span>
                ) : i === 1 ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse block" />
                ) : null}
              </div>
              <span
                className={[
                  "text-[13px]",
                  i <= 1 ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
