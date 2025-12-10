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
      "Manual Tracking",
      "Basic Recipe Storage",
      "Standard Shopping List",
    ],
    buttonText: "Sign Up Free",
    highlighted: false,
  },
  {
    name: "Pro Chef",
    price: "$12",
    period: "/mo",
    features: [
      "Unlimited AI Planning",
      "URL Recipe Scraping",
      "Instacart Integration",
      "Macro Balancing Agent",
    ],
    buttonText: "Start Trial",
    highlighted: true,
    badge: "Recommended",
  },
  {
    name: "Family",
    price: "$29",
    period: "/mo",
    features: [
      "Up to 5 Profiles",
      "Consolidated Shopping",
      "Dietary Conflict Check",
    ],
    buttonText: "Contact Sales",
    highlighted: false,
  },
];

export function PricingSection({ className }: PricingSectionProps) {
  return (
    <section
      id="pricing"
      className={cn(
        "py-24 px-6 md:px-12 bg-muted/30 border-t border-border",
        className
      )}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-4 block">
            Pricing
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-semibold text-foreground tracking-tight mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-muted-foreground">
            Invest in your health for less than the cost of one takeout meal.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {pricingPlans.map((plan) => (
            <PricingCard
              key={plan.name}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              features={plan.features}
              buttonText={plan.buttonText}
              highlighted={plan.highlighted}
              badge={plan.badge}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
