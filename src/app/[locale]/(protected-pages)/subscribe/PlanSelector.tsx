"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import { Check, Lock, Sparkles, ShoppingCart, Link as LinkIcon, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/actions/subscription";
import { cn } from "@/lib/utils";

export interface PlanOption {
  interval: "monthly" | "yearly";
  currency: "usd" | "eur" | "pln";
  priceLabel: string;
}

interface PlanSelectorProps {
  plans: PlanOption[];
  /** When true, present the primary CTA as a free trial. */
  trialEligible?: boolean;
  /** Trial length in days (resolved server-side from STRIPE_TRIAL_DAYS). */
  trialDays?: number;
}

const contentByLocale = {
  en: {
    featuresTitle: "Why upgrade to DietAI Pro?",
    featuresSubtitle: "Unlock advanced AI features designed to simplify your meal planning and nutrition.",
    features: [
      {
        title: "AI Meal Plans",
        description: "Create custom, calorie-balanced menus in seconds.",
      },
      {
        title: "Shopping Automation",
        description: "Fills your online grocery cart at Auchan, Carrefour, and Frisco.",
      },
      {
        title: "URL & PDF Imports",
        description: "Import recipes from cooking websites, YouTube, or photos.",
      },
      {
        title: "AI Chat Assistant",
        description: "Ask questions, balance macros, and get recipe ideas.",
      },
    ]
  },
  es: {
    featuresTitle: "¿Por qué pasarse a DietAI Pro?",
    featuresSubtitle: "Desbloqueá funciones avanzadas de IA diseñadas para simplificar tu planificación y nutrición.",
    features: [
      {
        title: "Planes de comida con IA",
        description: "Crea menús personalizados y balanceados en segundos.",
      },
      {
        title: "Automatización de compras",
        description: "Llena tu carrito online en Auchan, Carrefour y Frisco.",
      },
      {
        title: "Importaciones de URL y PDF",
        description: "Importa recetas desde blogs, YouTube o fotos.",
      },
      {
        title: "Asistente de chat con IA",
        description: "Hacé preguntas, balanceá macros y obtené ideas.",
      },
    ]
  },
  pl: {
    featuresTitle: "Dlaczego warto przejść na DietAI Pro?",
    featuresSubtitle: "Odblokuj zaawansowane funkcje AI ułatwiające planowanie posiłków i dietę.",
    features: [
      {
        title: "Plany posiłków z AI",
        description: "Twórz spersonalizowane jadłospisy w kilka sekund.",
      },
      {
        title: "Automatyzacja zakupów",
        description: "Automatycznie zapełnia koszyk w Auchan, Carrefour i Frisco.",
      },
      {
        title: "Import z URL i PDF",
        description: "Importuj przepisy ze stron www, YouTube lub zdjęć.",
      },
      {
        title: "Asystent czatu AI",
        description: "Zadawaj pytania, bilansuj makro i szukaj pomysłów.",
      },
    ]
  }
} as const;

export function PlanSelector({
  plans,
  trialEligible = false,
  trialDays = 14,
}: PlanSelectorProps) {
  const t = useTranslations("billing.pricing");
  const tTrial = useTranslations("billing.trial");
  const locale = useLocale() as "en" | "es" | "pl";
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const [isPending, startTransition] = useTransition();

  const activeContent = contentByLocale[locale] || contentByLocale.en;

  const intervalLabel = {
    monthly: t("intervalMonthly"),
    yearly: t("intervalYearly"),
  } as const;

  const billedLabel = {
    monthly: t("billedMonthly"),
    yearly: t("billedYearly"),
  } as const;

  const perPeriodLabel = {
    monthly: t("perMonth"),
    yearly: t("perYear"),
  } as const;

  const handleSubscribe = () => {
    const plan = plans.find((p) => p.interval === selected);
    if (!plan) return;

    startTransition(async () => {
      const result = await createCheckoutSession({
        interval: plan.interval,
        currency: plan.currency,
        withTrial: trialEligible,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? t("somethingWentWrong"));
        return;
      }
      window.location.href = result.data.url;
    });
  };

  const featureIcons = [
    <Sparkles key="1" className="w-5 h-5 text-brand-500 shrink-0" />,
    <ShoppingCart key="2" className="w-5 h-5 text-brand-500 shrink-0" />,
    <LinkIcon key="3" className="w-5 h-5 text-brand-500 shrink-0" />,
    <MessageSquare key="4" className="w-5 h-5 text-brand-500 shrink-0" />,
  ];

  return (
    <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
      {/* Left Column: Pro Features List */}
      <div className="col-span-12 lg:col-span-7 flex flex-col justify-center space-y-6 lg:pr-8 text-left">
        <div className="space-y-2">
          <h2 className="text-2xl font-display font-semibold text-foreground tracking-tight">
            {activeContent.featuresTitle}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {activeContent.featuresSubtitle}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {activeContent.features.map((feature, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-border/40 bg-stone-50/30 dark:bg-stone-900/10 flex items-start gap-3 hover:border-brand-200/50 hover:bg-stone-50/60 dark:hover:bg-slate-900/20 transition-all duration-300"
            >
              <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950/20 border border-brand-100/30">
                {featureIcons[idx]}
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-normal">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Pricing Plans & Selector */}
      <div className="col-span-12 lg:col-span-5 flex flex-col justify-between p-6 sm:p-8 rounded-2xl border border-border/80 bg-white/50 dark:bg-stone-900/35 glass shadow-xl">
        <div className="space-y-4 mb-6">
          <div className="text-left mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {t("choosePlan")}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {plans.map((plan) => {
              const isSelected = selected === plan.interval;
              const isYearly = plan.interval === "yearly";
              return (
                <button
                  key={plan.interval}
                  onClick={() => setSelected(plan.interval)}
                  type="button"
                  className={cn(
                    "w-full text-left rounded-xl border p-4 transition-all relative flex flex-col justify-between gap-3 cursor-pointer",
                    isSelected
                      ? isYearly
                        ? "border-amber-500 bg-amber-50/10 dark:bg-amber-950/10 ring-1 ring-amber-500/20 shadow-sm"
                        : "border-brand-500 bg-brand-50/10 dark:bg-brand-950/10 ring-1 ring-brand-500/20 shadow-sm"
                      : "border-border/60 hover:bg-stone-50 dark:hover:bg-slate-900/40 hover:border-border"
                  )}
                >
                  <div className="flex items-start justify-between w-full">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground">
                          {intervalLabel[plan.interval]}
                        </span>
                        {isYearly && (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200/50">
                            {t("savePercent")}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {billedLabel[plan.interval]}
                      </span>
                    </div>

                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                      isSelected
                        ? isYearly
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-brand-500 border-brand-500 text-white"
                        : "border-border bg-transparent"
                    )}>
                      {isSelected && (
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-display font-bold text-foreground">
                      {plan.priceLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {perPeriodLabel[plan.interval]}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleSubscribe}
            disabled={isPending}
            className="w-full bg-primary hover:bg-brand-600 text-primary-foreground font-semibold py-5 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
            size="lg"
          >
            {isPending ? (
              <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground"></span>
            ) : trialEligible ? (
              tTrial("startCta", { days: trialDays })
            ) : (
              t("continueToCheckout")
            )}
          </Button>

          {trialEligible && (
            <p className="text-[11px] text-muted-foreground text-center">
              {tTrial("subtext", { days: trialDays })}
            </p>
          )}

          <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1.5 border-t border-border/40 pt-3">
            <Lock className="w-3 h-3 text-stone-400 dark:text-stone-500 shrink-0" />
            <span>{t("stripeFooter")}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

