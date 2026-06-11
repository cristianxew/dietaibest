"use client";

/**
 * Open the global chat drawer with a pre-filled (not auto-sent) prompt.
 * ChatContainer listens for this event app-wide and handles auth/paywall
 * gating before opening — callers just dispatch and forget.
 */
export function openChatWithPrompt(prompt: string): void {
  window.dispatchEvent(
    new CustomEvent("dietai:open-chat", { detail: { prompt } })
  );
}
