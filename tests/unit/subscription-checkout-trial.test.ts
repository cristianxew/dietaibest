import { beforeEach, describe, expect, it, vi } from "vitest";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — hoisted by vitest. Factories build the mocks inline so we can
// reach the fns via vi.mocked(...) after importing the real module name.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-intl/server", () => ({ getLocale: vi.fn(async () => "en") }));

vi.mock("@/lib/prisma", () => {
  const prisma = { user: { findUnique: vi.fn(), update: vi.fn() } };
  return { prisma, default: prisma };
});

vi.mock("@/lib/stripe", () => {
  const stripe = {
    checkout: { sessions: { create: vi.fn() } },
    customers: { create: vi.fn() },
  };
  return {
    stripe,
    resolvePrice: vi.fn(),
    proPriceLookupKey: (interval: string, currency: string) =>
      `pro_${interval}_${currency}`,
    stripeLocaleForNextLocale: () => "en",
    getTrialDays: vi.fn(() => 14),
  };
});

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { stripe, resolvePrice, getTrialDays } from "@/lib/stripe";
import { createCheckoutSession } from "@/actions/subscription";

// A free user who already has a Stripe customer (so ensureStripeCustomer is a
// no-op) and no active subscription (so the "already Pro" guardrail is skipped).
const freeUser = {
  id: "user-1",
  email: "u@dietai.test",
  plan: "starter",
  subscriptionStatus: null,
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: null,
  hasUsedTrial: false,
};

/** subscription_data passed to the last checkout.sessions.create call. */
function lastSubscriptionData() {
  const call = vi.mocked(stripe.checkout.sessions.create).mock.calls.at(-1);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (call?.[0] as any)?.subscription_data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: freeUser.email },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    ...freeUser,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(resolvePrice).mockResolvedValue({ id: "price_x" } as any);
  vi.mocked(stripe.checkout.sessions.create).mockResolvedValue({
    url: "https://checkout.stripe.test/abc",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  vi.mocked(getTrialDays).mockReturnValue(14);
});

describe("createCheckoutSession — trial gating", () => {
  it("grants a trial when withTrial=true and the user hasn't used one", async () => {
    const res = await createCheckoutSession({
      interval: "monthly",
      currency: "usd",
      withTrial: true,
    });

    expect(res.error).toBeNull();
    const sub = lastSubscriptionData();
    expect(sub.trial_period_days).toBe(14);
    expect(sub.trial_settings).toEqual({
      end_behavior: { missing_payment_method: "cancel" },
    });
  });

  it("uses the configured STRIPE_TRIAL_DAYS value via getTrialDays()", async () => {
    vi.mocked(getTrialDays).mockReturnValue(21);

    await createCheckoutSession({
      interval: "yearly",
      currency: "eur",
      withTrial: true,
    });

    expect(lastSubscriptionData().trial_period_days).toBe(21);
  });

  it("does NOT grant a trial when the user already used theirs", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...freeUser,
      hasUsedTrial: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await createCheckoutSession({
      interval: "monthly",
      currency: "usd",
      withTrial: true,
    });

    const sub = lastSubscriptionData();
    expect(sub.trial_period_days).toBeUndefined();
    expect(sub.trial_settings).toBeUndefined();
  });

  it("does NOT grant a trial when withTrial is omitted", async () => {
    await createCheckoutSession({ interval: "monthly", currency: "usd" });

    const sub = lastSubscriptionData();
    expect(sub.trial_period_days).toBeUndefined();
    // Metadata is still stamped on the subscription regardless.
    expect(sub.metadata.userId).toBe(freeUser.id);
  });
});
