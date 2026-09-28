import "server-only";

import { formatPrice } from "@/lib/format-price";
import {
  currencyForLocale,
  getTrialDays,
  proPriceLookupKey,
  resolvePrice,
  type BillingInterval,
  type SupportedCurrency,
} from "@/lib/stripe";

/** A Pro price as the landing renders it. */
export interface LandingProPrice {
  /** Localized amount, e.g. `$9.99` or `39 zł`. */
  label: string;
  /** Minor units (cents); used to compute the yearly saving. */
  unitAmount: number;
}

export interface LandingPricing {
  /** ISO 4217 code, upper-case (`USD` / `EUR` / `PLN`). */
  currency: string;
  trialDays: number;
  /** The free plan's zero amount in the locale's currency. */
  freeLabel: string;
  /** `null` when the price could not be loaded — its card is hidden. */
  monthly: LandingProPrice | null;
  yearly: LandingProPrice | null;
  /** Whole % saved by paying yearly; `null` unless both prices loaded and it is positive. */
  yearlySavingsPercent: number | null;
}

/** Stripe is on the landing's critical path; never let it hold the page hostage. */
const PRICE_TIMEOUT_MS = 3000;

/** `round((12 × monthly − yearly) / (12 × monthly) × 100)`, or `null` when there is no saving. */
export function yearlySavingsPercent(monthly: number, yearly: number): number | null {
  if (monthly <= 0 || yearly <= 0) return null;
  const percent = Math.round(((12 * monthly - yearly) / (12 * monthly)) * 100);
  return percent > 0 ? percent : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function loadProPrice(
  interval: BillingInterval,
  currency: SupportedCurrency,
  locale: string
): Promise<LandingProPrice> {
  // `resolvePrice` caches successes in memory, so only the first request per
  // process pays for the Stripe round trip.
  const price = await withTimeout(
    resolvePrice(proPriceLookupKey(interval, currency)),
    PRICE_TIMEOUT_MS
  );
  if (price.unit_amount == null) {
    throw new Error(`Stripe price ${price.id} has no unit_amount`);
  }
  return {
    label: formatPrice(price.unit_amount, price.currency, locale),
    unitAmount: price.unit_amount,
  };
}

/**
 * Loads the Pro prices for the landing's pricing section. Never throws: a
 * price that fails to load (missing lookup key, no STRIPE_SECRET_KEY, Stripe
 * outage or timeout) comes back as `null` and is logged, so the page still
 * renders with whatever is available.
 */
export async function loadLandingPricing(locale: string): Promise<LandingPricing> {
  const currency = currencyForLocale(locale);
  const [monthly, yearly] = await Promise.allSettled([
    loadProPrice("monthly", currency, locale),
    loadProPrice("yearly", currency, locale),
  ]);

  if (monthly.status === "rejected") {
    console.error("[landing] Failed to load the Pro monthly price:", monthly.reason);
  }
  if (yearly.status === "rejected") {
    console.error("[landing] Failed to load the Pro yearly price:", yearly.reason);
  }

  const monthlyPrice = monthly.status === "fulfilled" ? monthly.value : null;
  const yearlyPrice = yearly.status === "fulfilled" ? yearly.value : null;

  return {
    currency: currency.toUpperCase(),
    trialDays: getTrialDays(),
    freeLabel: formatPrice(0, currency, locale),
    monthly: monthlyPrice,
    yearly: yearlyPrice,
    yearlySavingsPercent:
      monthlyPrice && yearlyPrice
        ? yearlySavingsPercent(monthlyPrice.unitAmount, yearlyPrice.unitAmount)
        : null,
  };
}
