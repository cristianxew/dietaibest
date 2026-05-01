import Stripe from "stripe";

/**
 * Server-side Stripe client.
 *
 * Uses the secret key from the environment. Never import this in a client
 * component — only in server actions, route handlers, and `page.tsx` files.
 */
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is not set. Add it to .env.local (see .env.example)."
  );
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // Pin to the API version the installed SDK was generated against so
  // upgrades are explicit and predictable.
  apiVersion: "2026-03-25.dahlia",
  typescript: true,
  appInfo: {
    name: "DietAI",
    version: "0.1.0",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Plan / price configuration
// ─────────────────────────────────────────────────────────────────────────────

export type BillingInterval = "monthly" | "yearly";
export type SupportedCurrency = "usd" | "eur" | "pln";

/**
 * Maps the next-intl locale to the currency we bill in.
 * en → USD, es → EUR, pl → PLN.
 */
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

/**
 * Builds the lookup key that must match what you entered in the Stripe
 * dashboard when creating each price (Advanced options → Lookup key).
 *
 * Format: `pro_<interval>_<currency>` — e.g. `pro_monthly_usd`.
 */
export function proPriceLookupKey(
  interval: BillingInterval,
  currency: SupportedCurrency
): string {
  return `pro_${interval}_${currency}`;
}

// In-memory cache of resolved prices for the lifetime of the server process.
// Lookup keys -> price ids. Stripe prices are effectively immutable once
// created, so caching is safe.
const priceCache = new Map<string, Stripe.Price>();

/**
 * Resolves a Stripe Price by its lookup key. Throws if the price doesn't
 * exist or is inactive — that means the dashboard setup is incomplete.
 */
export async function resolvePrice(lookupKey: string): Promise<Stripe.Price> {
  const cached = priceCache.get(lookupKey);
  if (cached) return cached;

  const { data } = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
    expand: ["data.product"],
  });

  const price = data[0];
  if (!price) {
    throw new Error(
      `Stripe price with lookup_key "${lookupKey}" not found or inactive. ` +
        `Create it in the Stripe dashboard and set the lookup key in Advanced options.`
    );
  }

  priceCache.set(lookupKey, price);
  return price;
}

/**
 * Stripe Checkout supports a fixed set of locale codes. Map next-intl
 * locales to the matching Stripe locale; fall back to `auto` so Stripe
 * decides based on the browser.
 */
export type StripeCheckoutLocale = "en" | "es" | "pl" | "auto";

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
