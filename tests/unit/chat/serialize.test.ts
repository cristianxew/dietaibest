import { describe, it, expect } from "vitest";

import { summarizeForClient } from "@/lib/chat/serialize";
import type { ConversationTurnItem } from "@/lib/chat/llm-provider";

describe("summarizeForClient", () => {
  it("collapses consecutive assistant text deltas into one message", () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "hola" },
      { kind: "text", role: "assistant", text: "Ho" },
      { kind: "text", role: "assistant", text: "la" },
      { kind: "text", role: "assistant", text: "!" },
    ];
    const out = summarizeForClient(items);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ kind: "assistant", text: "Hola!" });
  });

  it("skips tool-call, metadata and usage items", () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "hola" },
      { kind: "tool-call", callId: "c1", toolName: "echo", input: {} },
      { kind: "metadata", role: "assistant", refusalDetected: true },
      { kind: "usage", inputTokens: 10, outputTokens: 2 },
    ];
    const out = summarizeForClient(items);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("user");
  });

  it("exposes the link persisted on a successful tool-result so reloads keep the affordance", () => {
    const items: ConversationTurnItem[] = [
      {
        kind: "tool-result",
        callId: "c1",
        toolName: "createRecipe",
        result: {
          ok: true,
          data: { recipeId: "r-1" },
          link: { type: "recipe", href: "/recipes/r-1", label: "Tarta" },
        },
      },
    ];
    const out = summarizeForClient(items);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      kind: "tool",
      ok: true,
      link: { type: "recipe", href: "/recipes/r-1", label: "Tarta" },
    });
  });

  it("omits the link for failed tool-results and malformed link shapes", () => {
    const items: ConversationTurnItem[] = [
      {
        kind: "tool-result",
        callId: "c1",
        toolName: "deleteRecipe",
        result: { ok: false, reason: "notFound", message: "nope" },
      },
      {
        kind: "tool-result",
        callId: "c2",
        toolName: "createRecipe",
        result: { ok: true, data: {}, link: { type: "bogus", href: 42 } },
      },
    ];
    const out = summarizeForClient(items);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ kind: "tool", ok: false });
    expect((out[0] as { link?: unknown }).link).toBeUndefined();
    expect((out[1] as { link?: unknown }).link).toBeUndefined();
  });
});
