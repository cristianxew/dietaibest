"use client";

import { PricingCard } from "../ui";
import { cn } from "@/lib/utils";

interface PricingSectionProps {
  className?: string;
}

const pricingPlans = [
  {
    name: "Starter",
    price: "$0",
    features: [
      "5 saved recipes",
      "Basic meal planning",
      "Shopping list export",
      "Nutrition basics guide",
    ],
    buttonText: "Get Started Free",
    href: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/mo",
    features: [
      "Unlimited recipes & plans",
      "Import from any URL or photo",
      "Advanced nutrition insights",
      "Grocery delivery integration",
      "Personalized meal feedback",
    ],
    buttonText: "Start 14-Day Free Trial",
    href: "/subscribe",
    highlighted: true,
    badge: "Most Popular",
  },
];

export function PricingSection({ className }: PricingSectionProps) {
  return (
    <section
      id="pricing"
      className={cn(
        "py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border",
        className
      )}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest rounded-full mb-4">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground tracking-tight mb-4">
            Invest in Your Health
          </h2>
          <p className="text-muted-foreground">
            Plans that grow with your needs—from getting started to unlocking the full nutrition pipeline.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {pricingPlans.map((plan) => (
            <PricingCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              features={plan.features}
              buttonText={plan.buttonText}
              href={plan.href}
              highlighted={plan.highlighted}
              badge={plan.badge}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
