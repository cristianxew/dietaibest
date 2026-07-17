import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

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
    };
  });
}

interface SubscribePageProps {
  searchParams?: Promise<{ canceled?: string }>;
}

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  const locale = await getLocale();
  const currency = currencyForLocale(locale);
  const t = await getTranslations("billing.pricing");

  const { data } = await getCurrentSubscription();
  if (data?.isPro) {
    redirect("/dashboard?alreadyPro=1");
  }

  const trialEligible = data?.trialEligible ?? false;
  const trialDays = data?.trialDays ?? 14;

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
    <div className="w-full min-h-[calc(100vh-4rem)] md:min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-background relative overflow-hidden noise">
      {/* Background decoration & Noise Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Top-right coral/peach glow */}
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 dark:opacity-15 animate-pulse-soft"
          style={{
            background: "radial-gradient(circle, var(--brand-200) 0%, transparent 70%)",
          }}
        />
        {/* Bottom-left golden amber glow */}
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 dark:opacity-10"
          style={{
            background: "radial-gradient(circle, #FED7AA 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="w-full max-w-5xl bg-card border border-border/80 shadow-2xl rounded-3xl overflow-hidden animate-scale-in relative z-10 p-6 sm:p-10 lg:p-12">
        <div className="text-center max-w-3xl mx-auto mb-10">
          <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight leading-tight md:leading-tight pb-2 bg-gradient-to-r from-brand-500 via-gold-500 to-brand-400 bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-base max-w-xl mx-auto leading-relaxed">
            {t("description")}
          </p>
        </div>

        {canceled ? (
          <Alert className="mb-6 max-w-3xl mx-auto border-brand-200 bg-brand-50/20 text-brand-850 dark:text-brand-300">
            <AlertTitle className="font-semibold">{t("canceledTitle")}</AlertTitle>
            <AlertDescription>{t("canceledDescription")}</AlertDescription>
          </Alert>
        ) : null}

        {loadError ? (
          <Alert variant="destructive" className="mb-6 max-w-3xl mx-auto">
            <AlertTitle className="font-semibold">{t("unavailableTitle")}</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : plans ? (
          <PlanSelector
            plans={plans}
            trialEligible={trialEligible}
            trialDays={trialDays}
          />
        ) : null}
      </div>
    </div>
  );
}
