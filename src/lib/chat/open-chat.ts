"use client";

/**
 * Opens the in-app Dietai chat with a pre-seeded composer prompt.
 * ChatContainer listens for this event (see ChatContainer.tsx); the
 * user still presses send — we never auto-submit on their behalf.
 */
export function openDietaiChat(prompt: string): void {
  window.dispatchEvent(
    new CustomEvent("dietai:open-chat", { detail: { prompt } })
  );
}
