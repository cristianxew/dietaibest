export type BillingInterval = "monthly" | "yearly";
export type SupportedCurrency = "usd" | "eur" | "pln";
export type StripeCheckoutLocale = "en" | "es" | "pl" | "auto";

export function currencyForLocale(locale: string): SupportedCurrency {
  switch (locale) {
    case "pl":
      return "pln";
    case "es":
      return "eur";
    case "en":
    default:
      return "usd";
  }
}

export function proPriceLookupKey(
  interval: BillingInterval,
  currency: SupportedCurrency
): string {
  return `pro_${interval}_${currency}`;
}

/** Default trial length when STRIPE_TRIAL_DAYS is unset or invalid. */
export const DEFAULT_TRIAL_DAYS = 14;

/**
 * Resolves the Stripe free-trial length (in days) from the `STRIPE_TRIAL_DAYS`
 * env var, falling back to {@link DEFAULT_TRIAL_DAYS}. Lets ops tune the trial
 * window in prod (e.g. Dokploy) without a code redeploy. Server-only — never
 * read process.env on the client; the value reaches the UI via the serialized
 * entitlements (`trialDays`).
 */
export function getTrialDays(): number {
  const n = parseInt(process.env.STRIPE_TRIAL_DAYS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TRIAL_DAYS;
}

export function stripeLocaleForNextLocale(locale: string): StripeCheckoutLocale {
  switch (locale) {
    case "en":
    case "es":
    case "pl":
      return locale;
    default:
      return "auto";
  }
}

/** Minimal structural shape of the bits of a Stripe.Subscription we read for
 * the billing period. Kept structural (not `Stripe.Subscription`) so it's pure
 * and trivially testable without constructing full SDK objects. */
type SubscriptionPeriodSource = {
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> };
};

/**
 * Resolves a subscription's current period end (Unix epoch seconds) to a Date.
 *
 * Stripe's **Basil** release (2025-03-31) removed `current_period_end` from the
 * Subscription object and moved it onto each subscription **item**. Our pinned
 * API version (`*.dahlia`) is post-Basil, so the authoritative source is
 * `items.data[0].current_period_end`. We fall back to the legacy top-level field
 * so the function stays correct across API versions (e.g. if a webhook endpoint
 * is registered with a slightly different version).
 *
 * Returns `null` when no period end is available (e.g. canceled subscriptions).
 */
export function resolveCurrentPeriodEnd(
  sub: SubscriptionPeriodSource
): Date | null {
  const fromItem = sub.items?.data?.[0]?.current_period_end;
  const seconds =
    typeof fromItem === "number"
      ? fromItem
      : typeof sub.current_period_end === "number"
        ? sub.current_period_end
        : null;
  return seconds === null ? null : new Date(seconds * 1000);
}
