import { describe, it, expect } from "vitest";

import { toModelMessages } from "@/lib/chat/llm-anthropic";
import type { ConversationTurnItem } from "@/lib/chat/llm-provider";

describe("toModelMessages — runtime history → AI SDK ModelMessage[]", () => {
  it("coalesces consecutive assistant text deltas into a single message", () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "Hi" },
      { kind: "text", role: "assistant", text: "Hello" },
      { kind: "text", role: "assistant", text: ", " },
      { kind: "text", role: "assistant", text: "how can I help?" },
    ];
    const out = toModelMessages(items);
    expect(out).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello, how can I help?" },
    ]);
  });

  it("folds a trailing tool-call into the preceding assistant text as a content array", () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "Search pasta" },
      { kind: "text", role: "assistant", text: "Searching" },
      { kind: "text", role: "assistant", text: " pasta…" },
      {
        kind: "tool-call",
        callId: "c1",
        toolName: "searchRecipes",
        input: { query: "pasta", limit: 8 },
      },
    ];
    const out = toModelMessages(items);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({
      role: "assistant",
      content: [
        { type: "text", text: "Searching pasta…" },
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "searchRecipes",
          input: { query: "pasta", limit: 8 },
        },
      ],
    });
  });

  it("emits a standalone tool-call assistant message when no preceding text exists", () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "Find oatmeal" },
      {
        kind: "tool-call",
        callId: "c1",
        toolName: "searchRecipes",
        input: { query: "oatmeal" },
      },
    ];
    const out = toModelMessages(items);
    expect(out[1]).toEqual({
      role: "assistant",
      content: [
        {
          type: "tool-call",
          toolCallId: "c1",
          toolName: "searchRecipes",
          input: { query: "oatmeal" },
        },
      ],
    });
  });

  it("emits a tool message with the v5+ output shape for tool results", () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "delete x1" },
      {
        kind: "tool-call",
        callId: "del-1",
        toolName: "deleteRecipe",
        input: { id: "x1", confirmed: true },
      },
      {
        kind: "tool-result",
        callId: "del-1",
        toolName: "deleteRecipe",
        result: { ok: true, data: { deleted: true } },
      },
      { kind: "text", role: "assistant", text: "Done." },
    ];
    const out = toModelMessages(items);
    const toolMsg = out.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    expect(toolMsg).toEqual({
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "del-1",
          toolName: "deleteRecipe",
          output: { type: "json", value: { ok: true, data: { deleted: true } } },
        },
      ],
    });
    // Trailing acknowledgement collapses to a plain string assistant message.
    expect(out[out.length - 1]).toEqual({ role: "assistant", content: "Done." });
  });

  it("skips system items (they travel via streamText.system, not messages)", () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "system", text: "internal note" },
      { kind: "text", role: "user", text: "hi" },
    ];
    const out = toModelMessages(items);
    expect(out).toEqual([{ role: "user", content: "hi" }]);
  });

  it("returns an empty array for an empty history", () => {
    expect(toModelMessages([])).toEqual([]);
  });
});
