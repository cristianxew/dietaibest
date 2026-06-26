import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { NutritionResults } from "@/components/nutrition/NutritionResults";
import type { AnalyzeProfileResult } from "@/actions/analyzeRecipe";
import type { Profile } from "@/lib/fdc";

const messages = {
  recipes: {
    fullNutritionTitle: "Full nutrition",
    nutritionPerServing: "per serving",
    noMicroData: "No micronutrient data",
    microGroup: { vitamins: "Vitamins", minerals: "Minerals", other: "Other" },
  },
};

function profile(overrides: Partial<Profile> = {}): Profile {
  const zero: Profile = {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
    cholesterol: 0, saturatedFat: 0, transFat: 0, vitaminA: 0, vitaminC: 0,
    vitaminD: 0, vitaminE: 0, vitaminK: 0, vitaminB12: 0, folate: 0, iron: 0,
    calcium: 0, magnesium: 0, potassium: 0, zinc: 0,
  };
  return { ...zero, ...overrides };
}

const results: AnalyzeProfileResult = {
  items: [
    {
      original: "200 g spinach", name: "spinach", nameNorm: "spinach",
      qty: 200, unit: "g", fdcId: 168462, description: "Spinach, raw",
      gramsTotal: 200, confidence: 1, portionNote: "", dataType: "SR Legacy",
      status: "OK", source: "fdc",
      macros: { kcal: 46, protein: 5.7, fat: 0.8, carbs: 7.3, fiber: 4.4 },
    },
  ],
  total: profile({ calories: 46, protein: 5.7, sodium: 158, vitaminC: 56 }),
  perServing: profile({ calories: 46, protein: 5.7, sodium: 158, vitaminC: 56 }),
  coverage: { total: 1, resolved: 1, estimated: 0, unrecognized: 0 },
  success: true,
};

function renderResults() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NutritionResults results={results} servings={1} />
    </NextIntlClientProvider>
  );
}

describe("NutritionResults — full macro + micronutrient coverage", () => {
  it("renders the per-ingredient breakdown table", () => {
    renderResults();
    expect(screen.getByText("Ingredient Breakdown")).toBeTruthy();
    expect(screen.getByText("200 g spinach")).toBeTruthy();
    expect(screen.getByText("Spinach, raw")).toBeTruthy();
  });

  it("exposes the full micronutrient panel from the per-serving profile", () => {
    renderResults();
    // Micros live behind the "Full nutrition" disclosure.
    fireEvent.click(screen.getByRole("button", { name: /Full nutrition/i }));
    expect(screen.getByText("Sodium")).toBeTruthy();
    expect(screen.getByText("Vitamin C")).toBeTruthy();
    expect(screen.getByText("158 mg")).toBeTruthy(); // sodium / serving
    expect(screen.getByText("56 mg")).toBeTruthy(); // vitamin C / serving
  });
});
