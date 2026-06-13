import type Stripe from "stripe";
import { NextResponse } from "next/server";

import { stripe, resolveCurrentPeriodEnd } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { planFromStripeStatus } from "@/lib/plan";

// Stripe webhooks need the raw body for signature verification, so we must
// opt out of the Edge runtime and body parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and copy the signing secret into .env.local."
    );
  }
  return secret;
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      getWebhookSecret()
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe webhook] signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscription(sub);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof (invoice as unknown as { subscription?: string | null })
            .subscription === "string"
            ? ((invoice as unknown as { subscription: string }).subscription)
            : null;
        if (subscriptionId) {
          // Stripe will retry via dunning; we just mark the status so the UI
          // can show a "payment failed — update your card" banner.
          await prisma.user.updateMany({
            where: { stripeSubscriptionId: subscriptionId },
            data: { subscriptionStatus: "past_due" },
          });
        }
        break;
      }

      case "checkout.session.completed": {
        // Stamp the customer + subscription ids onto the user row using the
        // `userId` we planted in `metadata` when creating the Checkout session.
        // The `customer.subscription.{created,updated}` events that follow
        // carry the authoritative status/plan/period-end and are handled above —
        // both families are needed; delivery order is NOT guaranteed.
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.metadata?.userId;
        const subId =
          typeof s.subscription === "string"
            ? s.subscription
            : s.subscription?.id ?? null;
        const custId =
          typeof s.customer === "string"
            ? s.customer
            : s.customer?.id ?? null;
        if (userId && custId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              stripeCustomerId: custId,
              ...(subId ? { stripeSubscriptionId: subId } : {}),
            },
          });
        } else {
          console.warn(
            `[stripe webhook] checkout.session.completed missing userId or customer; session=${s.id}`
          );
        }
        break;
      }

      case "invoice.payment_succeeded":
        // No-op. Handled via subscription.updated which follows.
        break;

      default:
        // Ignore unhandled events silently — they're fine.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[stripe webhook] handler error (${event.type}):`, err);
    // Return 500 so Stripe retries the delivery.
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

/**
 * Idempotent sync from a Stripe Subscription object to the DB User row.
 * Safe to call repeatedly — Stripe may deliver the same event more than once.
 */
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.warn(
      `[stripe webhook] received subscription event for unknown customer ${customerId}; ignoring.`
    );
    return;
  }

  // On `customer.subscription.deleted`, Stripe still sends the full object
  // with status=canceled. We clear the fields and drop the user to starter.
  const isDeleted = sub.status === "canceled";

  // Stripe Basil (2025-03-31) moved `current_period_end` off the subscription
  // and onto its items; our pinned API version is post-Basil. `resolveCurrentPeriodEnd`
  // reads from `items.data[0]` with a legacy fallback. See stripe-helpers.ts.
  const currentPeriodEnd = resolveCurrentPeriodEnd(sub);

  // Once a trial has been started, mark the account so it can't get a second
  // one. `trial_start` is set by Stripe whenever the sub began with a trial.
  const startedTrial = sub.trial_start != null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: isDeleted ? null : sub.id,
      subscriptionStatus: sub.status,
      plan: planFromStripeStatus(sub.status),
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      currentPeriodEnd: isDeleted ? null : currentPeriodEnd,
      ...(startedTrial ? { hasUsedTrial: true } : {}),
    },
  });
}
