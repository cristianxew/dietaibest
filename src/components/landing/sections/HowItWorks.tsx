"use client";

import { StepItem, StepConnector, TerminalCard, TerminalSection, TerminalRow } from "../ui";
import { cn } from "@/lib/utils";

interface HowItWorksProps {
  className?: string;
}

const steps = [
  {
    number: 1,
    title: "Profile & Goals Wizard",
    description:
      "Complete a 2-minute onboarding. AI determines your BMR, activity level, and dietary preferences (Vegan, Paleo, etc.).",
  },
  {
    number: 2,
    title: "Generate Weekly Plan",
    description:
      "Review your AI-generated menu. Swap meals with a click. The system learns what you like over time.",
  },
  {
    number: 3,
    title: "Shop & Cook",
    description:
      "Export ingredients to your preferred grocery delivery service. Follow step-by-step cooking guides.",
  },
];

const terminalLines = [
  { label: "Analyze Profile", value: "Male, 180lbs, Active" },
  { label: "Calc TDEE", value: "2,850 kcal" },
  { label: "Goal", value: "Hypertrophy (Surplus)" },
];

const mealPlan = [
  { meal: "Monday Breakfast", recipe: "Oatmeal & Whey" },
  { meal: "Monday Lunch", recipe: "Chicken Quinoa Bowl" },
  { meal: "Monday Dinner", recipe: "Steak & Asparagus" },
];

export function HowItWorks({ className }: HowItWorksProps) {
  return (
    <section
      id="how-it-works"
      className={cn("py-24 px-6 md:px-12 max-w-7xl mx-auto", className)}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        {/* Steps */}
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-widest mb-4 block">
            The Workflow
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-semibold text-foreground tracking-tight mb-8">
            From onboarding to <br />
            dinner in three steps.
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
        <TerminalCard title="wizard_v2.exe">
          {terminalLines.map((line, index) => (
            <div key={index}>
              <span className="text-primary">➜</span>{" "}
              <span className="text-muted-foreground">{line.label}:</span>{" "}
              <span className="text-foreground">{line.value}</span>
            </div>
          ))}

          <TerminalSection>
            <div className="text-muted-foreground mb-2">// Generating Plan...</div>
            {mealPlan.map((item, index) => (
              <TerminalRow
                key={index}
                label={item.meal}
                value={item.recipe}
              />
            ))}
          </TerminalSection>

          <button className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors">
            Confirm Plan
          </button>
        </TerminalCard>
      </div>
    </section>
  );
}
