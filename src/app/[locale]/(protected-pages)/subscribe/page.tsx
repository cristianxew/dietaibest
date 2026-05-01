import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";

import {
  currencyForLocale,
  proPriceLookupKey,
  resolvePrice,
  type BillingInterval,
  type SupportedCurrency,
} from "@/lib/stripe";
import { getCurrentSubscription } from "@/actions/subscription";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { PlanSelector, type PlanOption } from "./PlanSelector";

function formatPrice(
  unitAmount: number | null,
  currency: string,
  locale: string
): string {
  if (unitAmount == null) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(unitAmount / 100);
}

async function loadPlanOptions(
  currency: SupportedCurrency,
  locale: string
): Promise<PlanOption[]> {
  const intervals: BillingInterval[] = ["monthly", "yearly"];
  const prices = await Promise.all(
    intervals.map((interval) => resolvePrice(proPriceLookupKey(interval, currency)))
  );
  return intervals.map((interval, i) => {
    const p = prices[i];
    return {
      interval,
      currency,
      priceLabel: formatPrice(p.unit_amount, p.currency, locale),
      intervalLabel: interval === "monthly" ? "/month" : "/year",
    };
  });
}

interface SubscribePageProps {
  searchParams?: Promise<{ canceled?: string }>;
}

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  const locale = await getLocale();
  const currency = currencyForLocale(locale);

  const { data } = await getCurrentSubscription();
  if (data?.isPro) {
    redirect("/dashboard?alreadyPro=1");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const canceled = resolvedSearchParams?.canceled === "1";

  let plans: PlanOption[] | null = null;
  let loadError: string | null = null;
  try {
    plans = await loadPlanOptions(currency, locale);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load plans.";
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight mb-3">
          Upgrade to DietAI Pro
        </h1>
        <p className="text-muted-foreground">
          Unlimited recipes, meal plans, shopping automation, and AI-powered
          nutrition analysis. Cancel anytime.
        </p>
      </div>

      {canceled ? (
        <Alert className="mb-6">
          <AlertTitle>Checkout canceled</AlertTitle>
          <AlertDescription>
            No worries — you can pick a plan and try again whenever you&apos;re
            ready.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Billing unavailable</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : plans ? (
        <PlanSelector plans={plans} />
      ) : null}
    </div>
  );
}
