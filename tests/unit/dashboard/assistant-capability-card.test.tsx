import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { AssistantCapabilityCard } from "@/components/dashboard/AssistantCapabilityCard";
import en from "../../../messages/en.json";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-06-11T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function renderCard() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AssistantCapabilityCard />
    </NextIntlClientProvider>
  );
}

describe("AssistantCapabilityCard", () => {
  it("renders the card copy and exactly 3 suggestions", () => {
    renderCard();
    expect(screen.getByText("Your assistant can help")).toBeTruthy();
    expect(
      screen.getByText("Tap a suggestion to try it in the chat.")
    ).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(4); // 1 Faux Input + 3 Capability Links
  });

  it("is deterministic for a fixed date", () => {
    const first = renderCard();
    const labelsA = screen
      .getAllByRole("button")
      .map((b) => b.textContent);
    first.unmount();
    cleanup();

    renderCard();
    const labelsB = screen
      .getAllByRole("button")
      .map((b) => b.textContent);
    expect(labelsB).toEqual(labelsA);
  });

  it("dispatches the open-chat event with a prompt on click", () => {
    const spy = vi.fn();
    window.addEventListener("dietai:open-chat", spy);
    renderCard();
    // 0 is the faux input (empty prompt), 1 is the first capability link
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(spy).toHaveBeenCalledOnce();
    const detail = (spy.mock.calls[0][0] as CustomEvent).detail as {
      prompt: string;
    };
    expect(detail.prompt.length).toBeGreaterThan(0);
    window.removeEventListener("dietai:open-chat", spy);
  });
});
