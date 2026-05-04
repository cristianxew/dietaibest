import Stripe from "stripe";

export type {
  BillingInterval,
  SupportedCurrency,
  StripeCheckoutLocale,
} from "./stripe-helpers";
export {
  currencyForLocale,
  proPriceLookupKey,
  stripeLocaleForNextLocale,
} from "./stripe-helpers";

/**
 * Server-side Stripe client.
 *
 * Lazily initialized on first use so the module can be imported during the
 * Next.js build without STRIPE_SECRET_KEY being present in the build env.
 * Never import this in a client component.
 */
let _stripe: Stripe | null = null;

function getInstance(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  _stripe = new Stripe(key, {
    apiVersion: "2026-03-25.dahlia",
    typescript: true,
    appInfo: { name: "DietAI", version: "0.1.0" },
  });
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string | symbol) {
    const instance = getInstance();
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

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

