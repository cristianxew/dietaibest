import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { SuggestionChips } from "@/components/chat/SuggestionChips";
import { getCapability } from "@/lib/chat/capabilities";
import en from "../../../messages/en.json";

const UUID = "11111111-2222-4333-8444-555555555555";

let pathname = "/en/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function renderChips(
  capabilities = [
    getCapability("analyzeNutrition"),
    getCapability("generateRecipeImage"),
  ],
  onPick = vi.fn()
) {
  const result = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <SuggestionChips capabilities={capabilities} onPick={onPick} />
    </NextIntlClientProvider>
  );
  return { onPick, container: result.container };
}

describe("SuggestionChips", () => {
  it("renders a chip per capability", () => {
    pathname = "/en/dashboard";
    renderChips();
    expect(screen.getByText("Analyze nutrition")).toBeTruthy();
    expect(screen.getByText("Generate a recipe photo")).toBeTruthy();
  });

  it("picks the entity-aware prompt on a recipe page", () => {
    pathname = `/en/recipes/${UUID}`;
    const { onPick } = renderChips();
    fireEvent.click(screen.getByText("Analyze nutrition"));
    expect(onPick).toHaveBeenCalledWith(
      "Analyze the nutrition of this recipe"
    );
  });

  it("falls back to the generic prompt off-entity", () => {
    pathname = "/en/dashboard";
    const { onPick } = renderChips();
    fireEvent.click(screen.getByText("Analyze nutrition"));
    expect(onPick).toHaveBeenCalledWith("How many calories and macros are in: ");
  });

  it("renders nothing for an empty list", () => {
    pathname = "/en/dashboard";
    const { container } = renderChips([]);
    expect(container.firstChild).toBeNull();
  });
});
