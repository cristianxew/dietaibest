import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
      eyebrow: "Active plan",
      dayMeals: "Day {day} meals",
      calendarDay: "{date}, plan day {day} of {total}",
      calendarDayOutside: "{date}, outside the plan",
      kcalUnit: "kcal",
    },
  },
  mealPlans: {
    mealTypes: { lunch: "Lunch" },
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

function renderPreview(
  selectedMeals: PreviewMeal[],
  props: Partial<React.ComponentProps<typeof ActivePlanPreview>> = {}
) {
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
        {...props}
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

describe("ActivePlanPreview — header and meal labels", () => {
  it("labels the card as the active plan and translates the meal type", () => {
    renderPreview([meal("1", "Lentil Soup", 20.7, 1)]);

    expect(screen.getByText("Active plan")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
  });

  it("titles another day's meals with its plan day", () => {
    renderPreview([], { currentDayNumber: 2, selectedDayNumber: 3 });

    expect(screen.getByText("Day 3 meals")).toBeInTheDocument();
  });
});

// The mini calendar shows 3 days before today, today and 3 after; days
// outside the plan can't be selected.
describe("ActivePlanPreview — calendar days", () => {
  it("renders each day as a button, marking the selected one as pressed", () => {
    renderPreview([], { currentDayNumber: 4, selectedDayNumber: 5 });

    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0]).toHaveAccessibleName(/plan day 5 of 7$/);
  });

  it("disables days outside the plan", () => {
    renderPreview([], { currentDayNumber: 1, selectedDayNumber: 1 });

    const outside = screen.getAllByRole("button", { name: /outside the plan$/ });
    expect(outside).toHaveLength(3);
    for (const button of outside) expect(button).toBeDisabled();
  });

  it("selects a plan day on click", () => {
    const onSelectDay = vi.fn();
    renderPreview([], { currentDayNumber: 1, selectedDayNumber: 1, onSelectDay });

    fireEvent.click(screen.getByRole("button", { name: /plan day 2 of 7$/ }));
    expect(onSelectDay).toHaveBeenCalledWith(2);
  });
});
