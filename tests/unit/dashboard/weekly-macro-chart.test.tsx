import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { WeeklyMacroChart } from "@/components/dashboard/WeeklyMacroChart";
import type { WeeklyMacroData } from "@/actions/dashboard";
import en from "../../../messages/en.json";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DATES = [
  "2026-09-28",
  "2026-09-29",
  "2026-09-30",
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
];

// Plan starts on Wednesday; today is Thursday.
const data: WeeklyMacroData[] = DAYS.map((dayName, i) => {
  const hasData = i >= 2;
  return {
    date: DATES[i],
    dayName,
    calories: hasData ? 2000 + i * 10 : 0,
    protein: hasData ? 120 : 0,
    carbs: hasData ? 200 : 0,
    fat: hasData ? 70 : 0,
    hasData,
    isToday: i === 3,
    isFuture: i > 3,
  };
});

function renderChart(highlightDate?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <WeeklyMacroChart
        data={data}
        targetCalories={2400}
        targetProtein={150}
        targetCarbs={250}
        targetFat={80}
        highlightDate={highlightDate}
      />
    </NextIntlClientProvider>
  );
}

const row = (dayName: string) => screen.getByText(dayName).closest<HTMLElement>("div.flex")!;

describe("WeeklyMacroChart", () => {
  it("offers Calories, Protein, Carbs, Fat toggles with pressed state", () => {
    renderChart();

    const group = screen.getByRole("group", { name: "Nutrient to show" });
    const toggles = within(group).getAllByRole("button");
    expect(toggles.map((b) => b.textContent)).toEqual(["Kcal", "Protein", "Carbs", "Fat"]);
    expect(toggles.map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
      "false",
    ]);

    fireEvent.click(toggles[1]);
    expect(toggles[1]).toHaveAttribute("aria-pressed", "true");
    expect(toggles[0]).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Target: 150 g")).toBeInTheDocument();
  });

  it("shows planned future days at full strength", () => {
    renderChart();

    const saturday = row("Sat");
    expect(saturday.className).not.toMatch(/opacity/);
    expect(within(saturday).getByText("2,050")).toHaveClass("text-foreground");
  });

  it("shows a dash for days without planned meals", () => {
    renderChart();

    const monday = row("Mon");
    expect(within(monday).getByText("—")).toBeInTheDocument();
    expect(within(monday).getByText("No meals planned")).toHaveClass("sr-only");
  });

  it("highlights today by default and the selected day when given", () => {
    const { unmount } = renderChart();
    expect(row("Thu").className).toMatch(/ring-1/);
    unmount();

    renderChart("2026-10-02");
    expect(row("Fri").className).toMatch(/ring-1/);
    expect(row("Thu").className).not.toMatch(/ring-1/);
  });
});
