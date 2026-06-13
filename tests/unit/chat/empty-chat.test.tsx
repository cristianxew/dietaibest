import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { EmptyChat } from "@/components/chat/EmptyChat";
import en from "../../../messages/en.json";

const UUID = "11111111-2222-4333-8444-555555555555";

let pathname = "/en/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function renderEmptyChat(onSuggestionClick = vi.fn()) {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <EmptyChat onSuggestionClick={onSuggestionClick} />
    </NextIntlClientProvider>
  );
  return onSuggestionClick;
}

describe("EmptyChat", () => {
  it("shows recipe actions with entity-aware prompts on a recipe detail page", () => {
    pathname = `/en/recipes/${UUID}`;
    const onSuggestionClick = renderEmptyChat();

    fireEvent.click(screen.getByText("Analyze nutrition"));
    expect(onSuggestionClick).toHaveBeenCalledWith(
      "Analyze the nutrition of this recipe"
    );
    expect(screen.getByText("Generate a recipe photo")).toBeTruthy();
    expect(screen.getByText("Add a recipe to my plan")).toBeTruthy();
  });

  it("falls back to the generic prompt when the page has no recipe entity", () => {
    pathname = "/en/nutrition";
    const onSuggestionClick = renderEmptyChat();

    fireEvent.click(screen.getByText("Analyze nutrition"));
    expect(onSuggestionClick).toHaveBeenCalledWith(
      "How many calories and macros are in: "
    );
  });

  it("shows the general set on the dashboard", () => {
    pathname = "/en/dashboard";
    const onSuggestionClick = renderEmptyChat();

    const create = screen.getByText("Create a recipe by describing it");
    fireEvent.click(create);
    expect(onSuggestionClick).toHaveBeenCalledWith(
      "I want to cook a high-protein vegetarian risotto"
    );
  });

  it("renders at most 5 suggestions", () => {
    pathname = `/en/recipes/${UUID}`;
    renderEmptyChat();
    expect(screen.getAllByRole("button").length).toBeLessThanOrEqual(5);
  });
});
