"use server";

import { z } from "zod";
import type Stripe from "stripe";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  stripe,
  resolvePrice,
  proPriceLookupKey,
  trialDays,
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

// ─────────────────────────────────────────────────────────────────────────────
// createSubscriptionIntent
// ─────────────────────────────────────────────────────────────────────────────

const createSubscriptionIntentSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
  currency: z.enum(["usd", "eur", "pln"]),
});

export type CreateSubscriptionIntentInput = z.infer<
  typeof createSubscriptionIntentSchema
>;

export type CreateSubscriptionIntentResult =
  | {
      data: {
        clientSecret: string;
        /**
         * `"setup"` when a trial is active (no payment is due up front, so
         * we collect a SetupIntent to store the card). `"payment"` when the
         * subscription starts billing immediately.
         */
        type: "setup" | "payment";
        subscriptionId: string;
      };
      error: null;
    }
  | { data: null; error: string };

/**
 * Creates (or reuses) a Stripe customer and creates a new Pro subscription
 * in `default_incomplete` status with a trial. Returns the client secret the
 * browser needs to confirm the Payment/Setup Intent via Stripe Elements.
 */
export async function createSubscriptionIntent(
  input: CreateSubscriptionIntentInput
): Promise<CreateSubscriptionIntentResult> {
  try {
    const parsed = createSubscriptionIntentSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: "Invalid input" };
    }
    const { interval, currency } = parsed.data;

    const { user, error } = await getAuthenticatedUser();
    if (error || !user) {
      return { data: null, error: error ?? "Unauthorized" };
    }

    // Guardrail: if the user is already Pro, don't create a second subscription.
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

    const price = await resolvePrice(
      proPriceLookupKey(
        interval as BillingInterval,
        currency as SupportedCurrency
      )
    );

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price.id }],
      trial_period_days: trialDays() || undefined,
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
      metadata: {
        userId: user.id,
        lookupKey: price.lookup_key ?? "",
      },
    });

    // With a trial, Stripe returns a pending_setup_intent (collect card for
    // later). Without a trial, it returns latest_invoice.payment_intent.
    const pendingSetup =
      subscription.pending_setup_intent as Stripe.SetupIntent | null;
    if (pendingSetup?.client_secret) {
      return {
        data: {
          clientSecret: pendingSetup.client_secret,
          type: "setup",
          subscriptionId: subscription.id,
        },
        error: null,
      };
    }

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice | null;
    const paymentIntent =
      (latestInvoice as unknown as { payment_intent?: Stripe.PaymentIntent })
        ?.payment_intent ?? null;
    if (paymentIntent?.client_secret) {
      return {
        data: {
          clientSecret: paymentIntent.client_secret,
          type: "payment",
          subscriptionId: subscription.id,
        },
        error: null,
      };
    }

    return {
      data: null,
      error:
        "Could not obtain a client secret from Stripe. Check the subscription state in the Stripe dashboard.",
    };
  } catch (err) {
    console.error("[createSubscriptionIntent] error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error creating subscription";
    return { data: null, error: message };
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

    const baseUrl =
      process.env.NEXTAUTH_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

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
