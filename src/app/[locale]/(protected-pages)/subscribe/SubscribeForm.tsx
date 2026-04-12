"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe as StripeJs } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

import { createSubscriptionIntent } from "@/actions/subscription";
import type {
  BillingInterval,
  SupportedCurrency,
} from "@/lib/stripe";

type IntentType = "setup" | "payment";

interface SubscribeFormProps {
  publishableKey: string;
  defaultCurrency: SupportedCurrency;
}

const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  usd: "USD",
  eur: "EUR",
  pln: "PLN",
};

const MONTHLY_PRICE_LABEL: Record<SupportedCurrency, string> = {
  usd: "$12 / month",
  eur: "€11 / month",
  pln: "49 zł / month",
};

const YEARLY_PRICE_LABEL: Record<SupportedCurrency, string> = {
  usd: "$108 / year",
  eur: "€99 / year",
  pln: "449 zł / year",
};

export function SubscribeForm({
  publishableKey,
  defaultCurrency,
}: SubscribeFormProps) {
  // Memoize so we don't re-create the Stripe instance across renders.
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey]
  );

  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [currency] = useState<SupportedCurrency>(defaultCurrency);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<IntentType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Create (or re-create) the subscription intent whenever the interval
  // changes. The server creates a fresh incomplete subscription each time —
  // Stripe auto-expires incomplete subs after 23 hours, so this is safe.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setClientSecret(null);
    setIntentType(null);
    setError(null);

    createSubscriptionIntent({ interval, currency })
      .then((result) => {
        if (cancelled) return;
        if (!result.data) {
          setError(result.error ?? "Could not start checkout");
          setLoading(false);
          return;
        }
        setClientSecret(result.data.clientSecret);
        setIntentType(result.data.type);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [interval, currency]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
      {/* Interval toggle */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
          <IntervalButton
            active={interval === "monthly"}
            onClick={() => setInterval("monthly")}
            label="Monthly"
            sub={MONTHLY_PRICE_LABEL[currency]}
          />
          <IntervalButton
            active={interval === "yearly"}
            onClick={() => setInterval("yearly")}
            label="Yearly"
            sub={YEARLY_PRICE_LABEL[currency]}
            badge="Save 25%"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Billed in {CURRENCY_LABELS[currency]}. 14-day free trial — you won&apos;t be charged today.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
          {error}
        </div>
      )}

      {loading && !clientSecret && (
        <div className="text-sm text-muted-foreground py-6">
          Loading secure checkout…
        </div>
      )}

      {clientSecret && intentType && (
        <Elements
          key={clientSecret}
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: { theme: "stripe" },
          }}
        >
          <PaymentStep stripePromise={stripePromise} intentType={intentType} />
        </Elements>
      )}
    </div>
  );
}

function IntervalButton({
  active,
  onClick,
  label,
  sub,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative rounded-md px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <span className="block">{label}</span>
      <span className="block text-xs opacity-80">{sub}</span>
      {badge && (
        <span className="absolute -top-2 -right-2 bg-gold-400 text-gold-900 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function PaymentStep({
  intentType,
}: {
  stripePromise: Promise<StripeJs | null>;
  intentType: IntentType;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErr(null);

    const returnUrl = `${window.location.origin}/dashboard?subscribed=1`;

    const result =
      intentType === "setup"
        ? await stripe.confirmSetup({
            elements,
            confirmParams: { return_url: returnUrl },
          })
        : await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: returnUrl },
          });

    if (result.error) {
      setErr(result.error.message ?? "Payment failed");
      setSubmitting(false);
      return;
    }
    // If no redirect was required, Stripe resolves here; otherwise the
    // browser is already navigating to return_url.
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {err && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-sm px-3 py-2">
          {err}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full rounded-lg bg-primary text-primary-foreground py-3 font-semibold shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Processing…" : "Start 14-Day Free Trial"}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        Your card will be saved but not charged until the trial ends. Cancel
        anytime from Settings → Billing.
      </p>
    </form>
  );
}
