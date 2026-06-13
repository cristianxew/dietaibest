"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { createCheckoutSession } from "@/actions/subscription";

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

export function PlanSelector({
  plans,
  trialEligible = false,
  trialDays = 14,
}: PlanSelectorProps) {
  const t = useTranslations("billing.pricing");
  const tTrial = useTranslations("billing.trial");
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const [isPending, startTransition] = useTransition();

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("choosePlan")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={selected}
          onValueChange={(value) => setSelected(value as "monthly" | "yearly")}
          className="space-y-3"
        >
          {plans.map((plan) => (
            <label
              key={plan.interval}
              htmlFor={`plan-${plan.interval}`}
              className="flex items-center justify-between rounded-lg border p-4 cursor-pointer hover:bg-accent/50 transition-colors has-[input:checked]:border-primary has-[input:checked]:bg-accent/40"
            >
              <div className="flex items-center gap-3">
                <RadioGroupItem
                  id={`plan-${plan.interval}`}
                  value={plan.interval}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {intervalLabel[plan.interval]}
                    </span>
                    {plan.interval === "yearly" ? (
                      <Badge variant="secondary">{t("savePercent")}</Badge>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {billedLabel[plan.interval]}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{plan.priceLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {perPeriodLabel[plan.interval]}
                </div>
              </div>
            </label>
          ))}
        </RadioGroup>

        <Button
          onClick={handleSubscribe}
          disabled={isPending}
          className="w-full"
          size="lg"
        >
          {isPending
            ? t("redirectingToStripe")
            : trialEligible
              ? tTrial("startCta", { days: trialDays })
              : t("continueToCheckout")}
        </Button>

        {trialEligible && (
          <p className="text-xs text-muted-foreground text-center">
            {tTrial("subtext", { days: trialDays })}
          </p>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {t("stripeFooter")}
        </p>
      </CardContent>
    </Card>
  );
}
