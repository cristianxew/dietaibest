"use client";

import { StepItem, StepConnector, TerminalCard, TerminalSection, TerminalRow } from "../ui";
import { cn } from "@/lib/utils";

interface HowItWorksProps {
  className?: string;
}

const steps = [
  {
    number: 1,
    title: "Set Your Targets",
    description:
      "Answer a few quick questions—your body stats, goals, and dietary preferences. DietAI calculates your ideal calories and macros automatically.",
  },
  {
    number: 2,
    title: "Plan, Adjust & Schedule",
    description:
      "Get a meal plan built around your targets. Swap recipes, adjust portions with AI to hit your macros, and drag everything onto your weekly calendar.",
  },
  {
    number: 3,
    title: "Shop on Autopilot",
    description:
      "Generate a shopping list in one click—or let the AI Shopping Agent add items to your cart and complete checkout at your preferred store.",
  },
];

const terminalLines = [
  { label: "Targets", value: "1,920 cal · 140g protein" },
  { label: "Goal", value: "Lose weight — steady deficit" },
  { label: "Prefs", value: "Mediterranean, no dairy" },
];

const mealPlan = [
  { meal: "Mon Breakfast", recipe: "Avocado & Egg Toast" },
  { meal: "Mon Lunch", recipe: "Grilled Chicken Bowl" },
  { meal: "Mon Dinner", recipe: "Herb-Crusted Salmon" },
];

export function HowItWorks({ className }: HowItWorksProps) {
  return (
    <section
      id="how-it-works"
      className={cn("py-20 md:py-28 px-4 sm:px-6 lg:px-8", className)}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Steps */}
        <div>
          <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest rounded-full mb-4">
            How It Works
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-semibold text-foreground tracking-tight mb-8">
            Your First Plan in <br />
            Under 5 Minutes
          </h2>

          <div className="space-y-0">
            {steps.map((step, index) => (
              <div key={step.number}>
                <StepItem
                  number={step.number}
                  title={step.title}
                  description={step.description}
                />
                {index < steps.length - 1 && <StepConnector />}
              </div>
            ))}
          </div>
        </div>

        {/* Terminal Visual */}
        <TerminalCard title="dietai_pipeline.log">
          {terminalLines.map((line, index) => (
            <div key={index}>
              <span className="text-primary">→</span>{" "}
              <span className="text-muted-foreground">{line.label}:</span>{" "}
              <span className="text-foreground">{line.value}</span>
            </div>
          ))}

          <TerminalSection>
            <div className="text-muted-foreground mb-2">{`// → Generated plan (adjusted to macros)`}</div>
            {mealPlan.map((item, index) => (
              <TerminalRow
                key={index}
                label={item.meal}
                value={item.recipe}
              />
            ))}
          </TerminalSection>

          <div className="text-xs text-muted-foreground mb-3 space-y-1">
            <div>Daily Average: <span className="text-foreground">1,920 cal</span> | <span className="text-foreground">142g protein</span> | <span className="text-foreground">180g carbs</span></div>
            <div className="text-sage-500">✓ All macros within target range</div>
          </div>

          <button className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors">
            Build My First Plan
          </button>
        </TerminalCard>
      </div>
    </section>
  );
}
