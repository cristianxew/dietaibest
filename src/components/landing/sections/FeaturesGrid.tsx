"use client";

import { FeatureCard } from "../ui";
import { cn } from "@/lib/utils";

interface FeaturesGridProps {
  className?: string;
}

const features = [
  {
    icon: "solar:link-bold-duotone",
    iconColor: "text-orange-500",
    title: "Smart Import",
    description:
      "Paste any URL, upload a PDF, or snap a photo of a menu. Our OCR agent extracts ingredients and calculates macros instantly.",
  },
  {
    icon: "solar:tuning-bold-duotone",
    iconColor: "text-blue-500",
    title: "Macro Auto-Balance",
    description:
      "Define your goals (e.g., High Protein, Keto). The planner agent automatically adjusts portion sizes in your recipes to hit targets.",
  },
  {
    icon: "solar:cart-large-4-bold-duotone",
    iconColor: "text-primary",
    title: "One-Click Pantry",
    description:
      "Generates a consolidated shopping list and integrates with Instacart & Amazon Fresh for instant checkout.",
  },
];

export function FeaturesGrid({ className }: FeaturesGridProps) {
  return (
    <section
      id="features"
      className={cn(
        "py-24 bg-muted/30 border-y border-border",
        className
      )}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* Section Header */}
        <div className="mb-16 max-w-2xl">
          <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-4 block">
            Features
          </span>
          <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground tracking-tight mb-4">
            Complete Nutrition Management
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Traditional apps require manual entry. DietAI uses agents to handle
            the tedious parts of nutrition, from reading recipes to buying
            groceries.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              iconColor={feature.iconColor}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
