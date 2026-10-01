import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { ActivePlanPreview } from "@/components/dashboard/ActivePlanPreview";

const messages = {
  dashboard: {
    activePlan: {
      day: "Day {current} of {total}",
      todaysMeals: "Today's Meals",
      viewPlan: "View Plan",
      viewAllPlans: "View All Plans",
      noMealsToday: "No meals scheduled for today",
      noRecipe: "No recipe",
      kcalUnit: "kcal",
    },
  },
};

type PreviewMeal = NonNullable<
  React.ComponentProps<typeof ActivePlanPreview>["selectedMeals"]
>[number];

function meal(id: string, title: string, calories: number | null, servings: number): PreviewMeal {
  return {
    id,
    mealType: "lunch",
    servings,
    recipe: { id: `r-${id}`, title, calories },
  };
}

function renderPreview(selectedMeals: PreviewMeal[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ActivePlanPreview
        templateId="tpl-1"
        templateName="Week 1"
        startDate={new Date("2026-10-01")}
        duration={7}
        currentDayNumber={1}
        daysRemaining={6}
        selectedDayNumber={1}
        selectedMeals={selectedMeals}
      />
    </NextIntlClientProvider>
  );
}

// Recipe calories are stored per serving; a planned meal's energy is
// calories × servings, the same figure the dashboard totals and the meal
// planner show, rounded to whole kcal for display.
describe("ActivePlanPreview — meal calories", () => {
  it("rounds a fractional per-serving value to whole kcal", () => {
    renderPreview([meal("1", "Lentil Soup", 20.72916666666667, 1)]);

    expect(screen.getByText("21 kcal")).toBeInTheDocument();
    expect(screen.queryByText(/20\.729/)).not.toBeInTheDocument();
  });

  it("scales by the meal's servings", () => {
    renderPreview([meal("1", "Beef Chili", 151.541, 2)]);

    expect(screen.getByText("303 kcal")).toBeInTheDocument();
  });

  it("shows no calorie label, not a stray 0, when the recipe has 0 kcal", () => {
    const { container } = renderPreview([meal("1", "Water", 0, 1)]);

    const row = screen.getByText("Water").parentElement!;
    expect(row.textContent).toBe("Water");
    expect(container.textContent).not.toMatch(/kcal/);
  });
});

describe("ActivePlanPreview — meal links", () => {
  it("links a planned meal to its recipe page, returning to the dashboard", () => {
    renderPreview([meal("1", "Lentil Soup", 20.7, 1)]);

    const link = screen.getByRole("link", { name: /Lentil Soup/ });
    expect(link).toHaveAttribute("href", "/en/recipes/r-1?from=%2Fdashboard");
  });

  it("does not link a meal that has no recipe", () => {
    renderPreview([{ id: "1", mealType: "lunch", servings: 1, recipe: null }]);

    expect(screen.getByText("No recipe")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /No recipe/ })).not.toBeInTheDocument();
  });
});
