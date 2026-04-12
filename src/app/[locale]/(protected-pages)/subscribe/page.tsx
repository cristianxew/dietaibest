import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import { SubscribeForm } from "./SubscribeForm";
import { currencyForLocale } from "@/lib/stripe";
import { getCurrentSubscription } from "@/actions/subscription";

export default async function SubscribePage() {
  const locale = await getLocale();
  const currency = currencyForLocale(locale);

  // Already Pro → nothing to do here.
  const { data } = await getCurrentSubscription();
  if (data?.isPro) {
    redirect("/dashboard?alreadyPro=1");
  }

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <h1 className="text-2xl font-semibold mb-2">Billing unavailable</h1>
        <p className="text-muted-foreground">
          Stripe is not configured for this environment. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-16 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight mb-3">
          Upgrade to DietAI Pro
        </h1>
        <p className="text-muted-foreground">
          14 days free, then unlimited recipes, meal plans, and nutrition
          insights. Cancel anytime.
        </p>
      </div>

      <SubscribeForm
        publishableKey={publishableKey}
        defaultCurrency={currency}
      />
    </div>
  );
}
