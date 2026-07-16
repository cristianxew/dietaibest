import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { MicronutrientPanel } from "@/components/meal-plans/MicronutrientPanel";
import { emptyMicros } from "@/lib/meal-plan-macros";
import type { ReferenceIntakes } from "@/lib/nutrition-rda";
import type { MicronutrientSummary } from "@/types/meal-plan";

const messages = {
  mealPlans: {
    micronutrients: {
      title: "Micronutrients",
      dailyAverage: "daily average",
      perDay: "this day",
      ofTarget: "{pct}% DV",
      ofLimit: "{pct}% of limit",
      sourcePersonalized: "Based on your age & sex",
      sourceStandard: "Based on standard daily values (%DV)",
      empty: "No micronutrient data for these recipes yet.",
      group: { vitamins: "Vitamins", minerals: "Minerals", other: "Other" },
    },
  },
};

const standardRef: ReferenceIntakes = {
  source: "standard",
  values: {
    iron: { value: 18, type: "goal" },
    sodium: { value: 2300, type: "limit" },
  },
};

function renderPanel(
  micros: MicronutrientSummary,
  reference: ReferenceIntakes,
  variant: "aggregate" | "day" = "aggregate"
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MicronutrientPanel micros={micros} reference={reference} variant={variant} />
    </NextIntlClientProvider>
  );
}

describe("MicronutrientPanel", () => {
  it("shows %DV for goal nutrients and % of limit for limit nutrients", () => {
    const micros: MicronutrientSummary = { ...emptyMicros(), iron: 9, sodium: 1150 };
    renderPanel(micros, standardRef);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("Iron")).toBeTruthy();
    expect(screen.getByText("50% DV")).toBeTruthy();
    expect(screen.getByText("50% of limit")).toBeTruthy();
    expect(screen.getByText("Based on standard daily values (%DV)")).toBeTruthy();
  });

  it("renders the empty state when no micronutrient has a value", () => {
    renderPanel(emptyMicros(), standardRef);
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByText("No micronutrient data for these recipes yet.")
    ).toBeTruthy();
  });

  it("labels the source as personalized when the reference is personalized", () => {
    const micros: MicronutrientSummary = { ...emptyMicros(), iron: 9 };
    renderPanel(micros, {
      source: "personalized",
      values: { iron: { value: 18, type: "goal" } },
    });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("Based on your age & sex")).toBeTruthy();
  });
});
