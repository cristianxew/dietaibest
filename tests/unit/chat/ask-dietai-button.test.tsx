import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { AskDietAIButton } from "@/components/chat/AskDietAIButton";
import { openChatWithPrompt } from "@/components/chat/openChat";

const listeners: Array<[string, EventListener]> = [];

function spyOnOpenChat() {
  const spy = vi.fn();
  window.addEventListener("dietai:open-chat", spy);
  listeners.push(["dietai:open-chat", spy]);
  return spy;
}

afterEach(() => {
  for (const [type, listener] of listeners.splice(0)) {
    window.removeEventListener(type, listener);
  }
});

describe("openChatWithPrompt", () => {
  it("dispatches the dietai:open-chat event with the prompt", () => {
    const spy = spyOnOpenChat();
    openChatWithPrompt("Import this recipe: ");
    expect(spy).toHaveBeenCalledOnce();
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toEqual({
      prompt: "Import this recipe: ",
    });
  });
});

describe("AskDietAIButton", () => {
  it("dispatches the open-chat event with its prompt on click", () => {
    const spy = spyOnOpenChat();
    render(
      <AskDietAIButton prompt="Analyze the nutrition of this recipe">
        Analyze nutrition
      </AskDietAIButton>
    );
    fireEvent.click(screen.getByText("Analyze nutrition"));
    expect(spy).toHaveBeenCalledOnce();
    expect((spy.mock.calls[0][0] as CustomEvent).detail).toEqual({
      prompt: "Analyze the nutrition of this recipe",
    });
  });
});
