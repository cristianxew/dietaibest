"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
  intervalLabel: string;
}

interface PlanSelectorProps {
  plans: PlanOption[];
}

export function PlanSelector({ plans }: PlanSelectorProps) {
  const [selected, setSelected] = useState<"monthly" | "yearly">("yearly");
  const [isPending, startTransition] = useTransition();

  const handleSubscribe = () => {
    const plan = plans.find((p) => p.interval === selected);
    if (!plan) return;

    startTransition(async () => {
      const result = await createCheckoutSession({
        interval: plan.interval,
        currency: plan.currency,
      });
      if (result.error || !result.data) {
        toast.error(result.error ?? "Something went wrong. Try again.");
        return;
      }
      window.location.href = result.data.url;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your plan</CardTitle>
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
                    <span className="font-medium capitalize">
                      {plan.interval}
                    </span>
                    {plan.interval === "yearly" ? (
                      <Badge variant="secondary">Save ~20%</Badge>
                    ) : null}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Billed {plan.interval}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold">{plan.priceLabel}</div>
                <div className="text-xs text-muted-foreground">
                  {plan.intervalLabel}
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
          {isPending ? "Redirecting to Stripe…" : "Continue to checkout"}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Secure payment handled by Stripe. You&apos;ll be redirected to a
          hosted checkout page.
        </p>
      </CardContent>
    </Card>
  );
}
