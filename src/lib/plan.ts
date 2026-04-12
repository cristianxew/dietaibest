/**
 * Plan helpers — single source of truth for "does this user have a paid plan?"
 *
 * We deliberately keep this tiny. Route-level gating lives in middleware;
 * feature-level gating should import `isPro` and branch in server actions
 * or server components near the enforcement point.
 */

export type PlanKey = "starter" | "pro";

/**
 * A user is considered Pro while the subscription is active or trialing.
 * `past_due` intentionally stays Pro — Stripe's dunning flow will retry;
 * we drop to starter only on `canceled` / `unpaid` / `incomplete_expired`
 * (handled by the webhook).
 */
export function isPro(user: {
  plan?: string | null;
  subscriptionStatus?: string | null;
}): boolean {
  if (user.plan !== "pro") return false;
  const status = user.subscriptionStatus;
  return (
    status === "trialing" ||
    status === "active" ||
    status === "past_due" ||
    // Allow null status for edge cases where webhook hasn't landed yet
    status == null
  );
}

/**
 * Given a raw Stripe subscription status, returns the DB `plan` value that
 * should be persisted. Used by the webhook handler.
 */
export function planFromStripeStatus(
  status: string | null | undefined
): PlanKey {
  switch (status) {
    case "trialing":
    case "active":
    case "past_due":
      return "pro";
    default:
      return "starter";
  }
}
