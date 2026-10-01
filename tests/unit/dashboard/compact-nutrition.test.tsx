import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { CompactNutrition } from "@/components/dashboard/CompactNutrition";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";
import pl from "../../../messages/pl.json";

const targets = {
  targetCalories: 2400,
  targetProtein: 150,
  targetCarbs: 250,
  targetFat: 80,
};

function renderCard(
  day: { calories: number; protein: number; carbs: number; fat: number },
  locale: "en" | "es" | "pl" = "en",
  messages: Record<string, unknown> = en
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <CompactNutrition {...day} {...targets} hasActivePlan />
    </NextIntlClientProvider>
  );
}

// 577 kcal with 99 / 50 / 21 g used to show 69 / 35 / 33 % (137%).
const day = { calories: 577, protein: 99, carbs: 50, fat: 21 };

describe("CompactNutrition", () => {
  it("labels the donut with calorie shares that add up to 100%", () => {
    renderCard(day);

    expect(
      screen.getByRole("img", {
        name: "Protein 50%, carbs 26%, fat 24% of calories",
      })
    ).toBeInTheDocument();
  });

  it("shows calorie progress as a line, not a badge", () => {
    renderCard(day);

    expect(screen.getByText("24% of 2,400 kcal")).toBeInTheDocument();
  });

  it("shows grams against target per macro, in protein / carbs / fat order", () => {
    renderCard(day);

    const rows = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual([
      "Protein99 / 150 g",
      "Carbs50 / 250 g",
      "Fat21 / 80 g",
    ]);
  });

  it("does not repeat the calorie share in the macro rows", () => {
    renderCard(day);

    for (const li of screen.getAllByRole("listitem")) {
      expect(li.textContent).not.toMatch(/%/);
    }
  });

  it("hides the donut from assistive tech when nothing is planned", () => {
    renderCard({ calories: 0, protein: 0, carbs: 0, fat: 0 });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("0% of 2,400 kcal")).toBeInTheDocument();
  });

  it.each([
    ["es", es, /^24\s%\sde 2400 kcal$/],
    ["pl", pl, /^24% z 2400 kcal$/],
  ] as const)("formats the progress line in %s", (locale, messages, expected) => {
    renderCard(day, locale, messages);

    expect(screen.getByText(expected)).toBeInTheDocument();
  });
});
