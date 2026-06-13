import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { CapabilityMenu } from "@/components/chat/CapabilityMenu";
import { capabilities } from "@/lib/chat/capabilities";
import en from "../../../messages/en.json";

let pathname = "/en/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

function renderMenu(visible = true, onSelect = vi.fn(), onClose = vi.fn()) {
  const result = render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CapabilityMenu visible={visible} onClose={onClose} onSelect={onSelect} />
    </NextIntlClientProvider>
  );
  return { onSelect, onClose, container: result.container };
}

describe("CapabilityMenu", () => {
  it("renders all four group headings", () => {
    pathname = "/en/dashboard";
    renderMenu();
    expect(screen.getByText("Recipes")).toBeTruthy();
    expect(screen.getByText("Meal plans")).toBeTruthy();
    expect(screen.getByText("Nutrition")).toBeTruthy();
    expect(screen.getByText("Import")).toBeTruthy();
  });

  it("renders a row for every catalog capability", () => {
    pathname = "/en/dashboard";
    renderMenu();
    const enCaps = (
      en as unknown as {
        chat: { capabilities: Record<string, { label: string }> };
      }
    ).chat.capabilities;
    for (const cap of capabilities) {
      expect(screen.getByText(enCaps[cap.id].label), cap.id).toBeTruthy();
    }
  });

  it("fires onSelect with the capability prompt", () => {
    pathname = "/en/dashboard";
    const { onSelect } = renderMenu();
    fireEvent.click(screen.getByText("Create a recipe by describing it"));
    expect(onSelect).toHaveBeenCalledWith(
      "I want to cook a high-protein vegetarian risotto"
    );
  });

  it("is aria-hidden when not visible", () => {
    pathname = "/en/dashboard";
    const { container } = renderMenu(false);
    expect(
      container.querySelector('[aria-hidden="true"]')
    ).toBeTruthy();
  });
});
