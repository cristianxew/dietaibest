"use client";

import { FeatureCard } from "../ui";
import { cn } from "@/lib/utils";

interface FeaturesGridProps {
  className?: string;
}

const features = [
  {
    icon: "solar:lightbulb-bolt-bold-duotone",
    iconColor: "text-sage-500",
    iconBg: "bg-sage-50 border-sage-100 dark:bg-sage-500/10 dark:border-sage-500/20",
    title: "Nutrition Learning",
    description:
      "Understand what you eat and why it matters. DietAI breaks down every meal so you build real knowledge—not just follow rules.",
  },
  {
    icon: "solar:tuning-bold-duotone",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20",
    title: "Personalized Meal Plans",
    description:
      "Set your calorie and macro targets, then let AI build weekly plans around your goals—whether that's losing weight, gaining muscle, or eating balanced.",
  },
  {
    icon: "solar:gallery-favourite-bold-duotone",
    iconColor: "text-orange-500",
    iconBg: "bg-orange-50 border-orange-100 dark:bg-orange-500/10 dark:border-orange-500/20",
    title: "Recipe Collection",
    description:
      "Save recipes from any link, photo, or PDF. DietAI extracts ingredients, calculates nutrition, and organizes everything in your personal cookbook.",
  },
  {
    icon: "solar:magic-stick-3-bold-duotone",
    iconColor: "text-violet-500",
    iconBg: "bg-violet-50 border-violet-100 dark:bg-violet-500/10 dark:border-violet-500/20",
    title: "Smart Recipe Adjustment",
    description:
      "Love a recipe but it doesn't fit your macros? AI adjusts portions and swaps ingredients to match your nutritional targets.",
  },
  {
    icon: "solar:copy-bold-duotone",
    iconColor: "text-brand-500",
    iconBg: "bg-brand-50 border-brand-100 dark:bg-brand-500/10 dark:border-brand-500/20",
    title: "Reusable Meal Plans",
    description:
      "Save your best weeks as templates and reuse them anytime. Perfect for busy schedules when you want proven plans without starting from scratch.",
  },
  {
    icon: "solar:calendar-bold-duotone",
    iconColor: "text-sky-500",
    iconBg: "bg-sky-50 border-sky-100 dark:bg-sky-500/10 dark:border-sky-500/20",
    title: "Calendar Scheduling",
    description:
      "Drag meals onto a weekly calendar to plan exactly when you'll eat what. See your nutrition totals update in real time as you schedule.",
  },
  {
    icon: "solar:cart-large-4-bold-duotone",
    iconColor: "text-primary",
    iconBg: "bg-brand-50 border-brand-100 dark:bg-brand-500/10 dark:border-brand-500/20",
    title: "Shopping List Generation",
    description:
      "One click turns your scheduled meals into an organized shopping list—grouped by aisle, with quantities combined across recipes.",
  },
  {
    icon: "solar:robot-bold-duotone",
    iconColor: "text-gold-500",
    iconBg: "bg-gold-50 border-gold-100 dark:bg-gold-500/10 dark:border-gold-500/20",
    title: "AI Shopping Agent",
    description:
      "Our AI agent adds items to your cart at your preferred store and can complete checkout for you—grocery shopping on autopilot.",
    className:
      "border-gold-200 dark:border-gold-500/30 bg-gradient-to-br from-gold-50/50 to-card dark:from-gold-500/5 dark:to-card ring-1 ring-gold-200/50 dark:ring-gold-500/20",
  },
];

export function FeaturesGrid({ className }: FeaturesGridProps) {
  return (
    <section
      id="features"
      className={cn(
        "py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/30 border-y border-border",
        className
      )}
    >
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest rounded-full mb-4">
            The Full Pipeline
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground tracking-tight mb-4">
            From Understanding to Your Doorstep
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Learn what fuels you, plan meals that hit your targets, collect and
            adjust recipes, schedule your week, and let AI handle the grocery
            run—one seamless pipeline.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <FeatureCard
              key={index}
              icon={feature.icon}
              iconColor={feature.iconColor}
              iconBg={feature.iconBg}
              title={feature.title}
              description={feature.description}
              className={feature.className}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
