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
