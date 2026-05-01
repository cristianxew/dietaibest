"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";

import { prisma } from "@/lib/prisma";
import {
  stripe,
  resolvePrice,
  proPriceLookupKey,
  stripeLocaleForNextLocale,
  type BillingInterval,
  type SupportedCurrency,
} from "@/lib/stripe";
import { isPro } from "@/lib/plan";

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper — mirrors the pattern used by src/actions/profile.ts
// ─────────────────────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return { user: null, error: "Unauthorized" as const };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return { user: null, error: "User not found" as const };
  }

  return { user, error: null };
}

/**
 * Ensures the user has an associated Stripe customer, creating one if
 * necessary. Always returns the customer id.
 */
async function ensureStripeCustomer(user: {
  id: string;
  email: string;
  stripeCustomerId: string | null;
}): Promise<string> {
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

function resolveBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// createCheckoutSession — Stripe-hosted Checkout (replaces embedded Elements)
// ─────────────────────────────────────────────────────────────────────────────

const createCheckoutSessionSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
  currency: z.enum(["usd", "eur", "pln"]),
});

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;

export type CreateCheckoutSessionResult =
  | { data: { url: string }; error: null }
  | { data: null; error: string };

/**
 * Creates a Stripe-hosted Checkout session for a Pro subscription and
 * returns the URL the browser should redirect to. Webhooks (`checkout.session.completed`
 * and the subsequent `customer.subscription.*` events) are authoritative for
 * flipping the user's plan in the DB — never trust the return URL.
 *
 * No trial: the freemium free tier replaces it. We always collect a payment
 * method up front (`payment_method_collection: "always"`).
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<CreateCheckoutSessionResult> {
  try {
    const parsed = createCheckoutSessionSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: "Invalid input" };
    }
    const { interval, currency } = parsed.data;

    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return { data: null, error: error ?? "Unauthorized" };
    }

    // Guardrail: if the user is already Pro, do not create a second subscription.
    if (
      isPro({
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
      }) &&
      user.stripeSubscriptionId
    ) {
      return { data: null, error: "You are already subscribed to Pro." };
    }

    const customerId = await ensureStripeCustomer({
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    });

    const lookupKey = proPriceLookupKey(
      interval as BillingInterval,
      currency as SupportedCurrency
    );
    const price = await resolvePrice(lookupKey);

    const locale = await getLocale();
    const baseUrl = resolveBaseUrl();
    const localePrefix = locale === "en" ? "" : `/${locale}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      // Pass the existing customer — NEVER `customer_email` — otherwise
      // Stripe creates a duplicate customer on every checkout.
      customer: customerId,
      success_url: `${baseUrl}${localePrefix}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}${localePrefix}/subscribe?canceled=1`,
      metadata: {
        userId: user.id,
        lookupKey,
      },
      // Belt-and-suspenders: stamp metadata onto the subscription too, so the
      // `customer.subscription.*` events carry it as well.
      subscription_data: {
        metadata: {
          userId: user.id,
          lookupKey,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      locale: stripeLocaleForNextLocale(locale),
      payment_method_collection: "always",
      // NOTE: automatic_tax intentionally omitted until Stripe Tax is
      // configured (TODO before real EU/PL revenue).
    });

    if (!session.url) {
      return {
        data: null,
        error:
          "Stripe did not return a Checkout URL. Check the Stripe dashboard for session details.",
      };
    }

    return { data: { url: session.url }, error: null };
  } catch (err) {
    console.error("[createCheckoutSession] error:", err);
    return {
      data: null,
      error:
        err instanceof Error ? err.message : "Unknown error creating checkout session",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// cancelSubscription / resumeSubscription
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelSubscription(): Promise<
  { data: { cancelAtPeriodEnd: true }; error: null } | { data: null; error: string }
> {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) return { data: null, error: error ?? "Unauthorized" };
    if (!user.stripeSubscriptionId) {
      return { data: null, error: "No active subscription to cancel." };
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    revalidatePath("/", "layout");
    return { data: { cancelAtPeriodEnd: true }, error: null };
  } catch (err) {
    console.error("[cancelSubscription] error:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function resumeSubscription(): Promise<
  { data: { cancelAtPeriodEnd: false }; error: null } | { data: null; error: string }
> {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) return { data: null, error: error ?? "Unauthorized" };
    if (!user.stripeSubscriptionId) {
      return { data: null, error: "No subscription to resume." };
    }

    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    revalidatePath("/", "layout");
    return { data: { cancelAtPeriodEnd: false }, error: null };
  } catch (err) {
    console.error("[resumeSubscription] error:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createPortalSession — opens the Stripe Customer Portal
// ─────────────────────────────────────────────────────────────────────────────

export async function createPortalSession(
  returnPath: string = "/settings"
): Promise<
  { data: { url: string }; error: null } | { data: null; error: string }
> {
  try {
    const { user, error } = await getAuthenticatedUser();
    if (error || !user) return { data: null, error: error ?? "Unauthorized" };

    const customerId = await ensureStripeCustomer({
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId,
    });

    const baseUrl = resolveBaseUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}${returnPath}`,
    });

    return { data: { url: session.url }, error: null };
  } catch (err) {
    console.error("[createPortalSession] error:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentSubscription — used by UI to show plan status / gating
// ─────────────────────────────────────────────────────────────────────────────

export async function getCurrentSubscription(): Promise<{
  data: {
    plan: string;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    isPro: boolean;
  } | null;
  error: string | null;
}> {
  const { user, error } = await getAuthenticatedUser();
  if (error || !user) return { data: null, error: error ?? "Unauthorized" };

  return {
    data: {
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      isPro: isPro({
        plan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
      }),
    },
    error: null,
  };
}
