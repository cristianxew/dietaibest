import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { localizedHref } from "../links";
import { loadLandingPricing } from "../pricing-data";
import { SectionHead } from "../ui/SectionHead";

interface PlanCard {
  key: string;
  name: string;
  /** A formatted price, or (when no Pro price could be loaded) the trial length. */
  amount: string;
  amountIsText?: boolean;
  period?: string;
  tagline: string;
  features: string[];
  cta: string;
  featured?: boolean;
  badge?: string;
}

const FREE_FEATURES = ["recipes", "newRecipes", "mealPlan", "nutrition", "shopping"] as const;
const PRO_FEATURES = ["unlimited", "import", "assistant", "photos", "cart"] as const;

/**
 * Free + Pro plans with live Stripe prices in the locale's currency. A Pro
 * price that fails to load hides its card; if both fail, a single Pro card
 * advertises the free trial instead of a price. Never throws.
 */
export async function PricingSection() {
  const [t, locale] = await Promise.all([getTranslations("landing.pricing"), getLocale()]);
  const pricing = await loadLandingPricing(locale);
  const days = pricing.trialDays;
  const trialCta = t("trialCta", { days });

  const proCard = (amount: string, amountIsText = false): PlanCard => ({
    key: "monthly",
    name: t("monthly.name"),
    amount,
    amountIsText,
    period: amountIsText ? undefined : t("monthly.period"),
    tagline: t("monthly.tagline"),
    features: PRO_FEATURES.map((key) => t(`monthly.features.${key}`)),
    cta: trialCta,
    featured: true,
    badge: t("badge"),
  });

  const plans: PlanCard[] = [
    {
      key: "free",
      name: t("free.name"),
      amount: pricing.freeLabel,
      period: t("free.period"),
      tagline: t("free.tagline"),
      features: FREE_FEATURES.map((key) => t(`free.features.${key}`)),
      cta: t("free.cta"),
    },
  ];

  if (pricing.monthly) {
    plans.push(proCard(pricing.monthly.label));
  }
  if (pricing.yearly) {
    plans.push({
      key: "yearly",
      name: t("yearly.name"),
      amount: pricing.yearly.label,
      period: t("yearly.period"),
      tagline: t("yearly.tagline"),
      features: [
        t("yearly.features.everything"),
        ...(pricing.yearlySavingsPercent
          ? [t("yearly.features.savings", { percent: pricing.yearlySavingsPercent })]
          : []),
        t("trialLength", { days }),
      ],
      cta: trialCta,
    });
  }
  if (!pricing.monthly && !pricing.yearly) {
    plans.push(proCard(t("trialLength", { days }), true));
  }

  return (
    <section id="pricing" className="scroll-mt-[68px] py-16">
      <div className="mx-auto max-w-[1180px] px-8">
        <SectionHead
          eyebrow={t("eyebrow")}
          title={t.rich("title", { em: (chunks) => <em>{chunks}</em> })}
          rhs={t("rhs")}
        />
        <div
          className={cn(
            "grid gap-4 max-[801px]:grid-cols-1",
            plans.length === 3 ? "grid-cols-3" : "mx-auto max-w-[780px] grid-cols-2"
          )}
        >
          {plans.map((plan) => {
            const featured = Boolean(plan.featured);
            return (
              <div
                key={plan.key}
                className={cn(
                  "flex min-w-0 flex-col rounded-[14px] border px-8 py-9 transition-colors duration-200 max-[1041px]:px-6",
                  featured
                    ? // Dark mode: --lp-ink equals the card surface, so the featured
                      // card gets a sage border and glow to stand apart.
                      "border-lp-ink-line bg-lp-ink text-lp-ink-fg dark:border-lp-primary/50 dark:shadow-[0_0_0_1px_color-mix(in_oklab,var(--lp-primary)_18%,transparent),0_24px_60px_-28px_color-mix(in_oklab,var(--lp-primary)_45%,transparent)]"
                    : "border-lp-line bg-lp-card hover:border-lp-fg"
                )}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span
                    className={cn(
                      "font-lp-mono text-[11px] uppercase tracking-[0.12em]",
                      featured ? "text-lp-ink-fg/70" : "text-lp-muted"
                    )}
                  >
                    {plan.name}
                  </span>
                  {plan.badge ? (
                    <span className="rounded-full bg-lp-primary-soft px-2.5 py-1 font-lp-mono text-[10px] uppercase tracking-[0.1em] whitespace-nowrap text-lp-ink">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "mb-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-lp-display font-medium tracking-[-0.02em]",
                    plan.amountIsText
                      ? "text-[34px] leading-[1.1]"
                      : "text-[clamp(34px,4.4vw,56px)] leading-none max-[801px]:text-[clamp(40px,12vw,56px)]"
                  )}
                >
                  {plan.amount}
                  {plan.period ? (
                    <span
                      className={cn(
                        "font-sans text-[14px] font-normal tracking-normal",
                        featured ? "text-lp-ink-fg/70" : "text-lp-muted"
                      )}
                    >
                      {plan.period}
                    </span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "mb-7 text-[14px] leading-[1.5]",
                    featured ? "text-lp-ink-fg/78" : "text-lp-fg-soft"
                  )}
                >
                  {plan.tagline}
                </p>
                <ul className="mb-8 flex flex-1 flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={cn(
                        "flex items-start gap-2.5 text-[14px] leading-[1.5] before:mt-[9px] before:size-[5px] before:shrink-0 before:rounded-full",
                        featured
                          ? "text-lp-ink-fg/70 before:bg-lp-primary-soft"
                          : "text-lp-fg-soft before:bg-lp-primary"
                      )}
                    >
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={localizedHref(locale, "/sign-up")}
                  className={cn(
                    "block w-full rounded-full border px-[18px] py-3 text-center text-[14px] font-medium transition-all duration-150",
                    featured
                      ? "border-lp-ink-fg bg-lp-ink-fg text-lp-ink hover:border-lp-primary hover:bg-lp-primary hover:text-white"
                      : "border-lp-line bg-transparent text-lp-fg hover:border-lp-fg hover:bg-lp-fg hover:text-lp-bg"
                  )}
                >
                  {plan.cta} →
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mx-auto mt-8 max-w-[70ch] text-center text-[13px] leading-[1.6] text-lp-muted">
          {t("finePrint")} {t("currency", { currency: pricing.currency })}
        </p>
      </div>
    </section>
  );
}
