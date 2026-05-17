import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

import { AgentRuntime } from "@/lib/chat/runtime";
import type { LlmProvider } from "@/lib/chat/llm-provider";
import type { AnyTool } from "@/lib/chat/tools/types";

import { PRO, FREE, makeCtx, FakeStore, ScriptedProvider, collect } from "./_fixtures";

const echoToolSchema = z.object({ value: z.string() });
const echoTool: AnyTool = {
  name: "echo",
  description: "Returns its input value.",
  inputSchema: echoToolSchema,
  statusKey: "tool.invoked",
  async execute(input) {
    return { ok: true, data: { echoed: (input as { value: string }).value } };
  },
};

const proOnlyTool: AnyTool = {
  name: "proOnly",
  description: "Pro feature.",
  inputSchema: z.object({}),
  statusKey: "tool.invoked",
  requiresFeature: "aiChat",
  async execute() {
    return { ok: true, data: { ok: true } };
  },
};

const confirmTool: AnyTool = {
  name: "deleteThing",
  description: "delete",
  inputSchema: z.object({ id: z.string(), confirmed: z.boolean().optional() }),
  statusKey: "recipe.deleting",
  async requiresConfirmation(input) {
    if ((input as { confirmed?: boolean }).confirmed) return null;
    return {
      message: "thing-name",
      payload: { id: (input as { id: string }).id, confirmed: true },
    };
  },
  async execute() {
    return { ok: true, data: { deleted: true } };
  },
};

describe("AgentRuntime — text-only happy path", () => {
  let store: FakeStore;
  let runtime: AgentRuntime;

  beforeEach(() => {
    store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        { kind: "text-delta", text: "Hello. " },
        { kind: "text-delta", text: "How can I help?" },
        { kind: "finish" },
      ],
    ]);
    runtime = new AgentRuntime({ llm: provider, store, tools: [echoTool] });
  });

  it("streams text deltas and emits a finish event", async () => {
    const events = await collect(
      runtime.run({ ctx: makeCtx(), userMessage: "Hi" })
    );
    const types = events.map((e) => e.type);
    expect(types).toContain("text.delta");
    expect(types[types.length - 1]).toBe("finish");
  });

  it("persists user + assistant turns through ConversationStore", async () => {
    await collect(runtime.run({ ctx: makeCtx(), userMessage: "Hi" }));
    const userItems = store.history.filter(
      (i) => i.kind === "text" && i.role === "user"
    );
    const asstItems = store.history.filter(
      (i) => i.kind === "text" && i.role === "assistant"
    );
    expect(userItems).toHaveLength(1);
    expect(asstItems.length).toBeGreaterThan(0);
  });
});

describe("AgentRuntime — tool loop", () => {
  it("dispatches a tool call and feeds the result back for an acknowledgement", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        { kind: "tool-call", callId: "c1", toolName: "echo", input: { value: "hi" } },
      ],
      [
        { kind: "text-delta", text: "Got it." },
        { kind: "finish" },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [echoTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "use tool" }));

    const types = events.map((e) => e.type);
    expect(types).toContain("tool.invoked");
    expect(types).toContain("tool.completed");
    expect(types).toContain("text.delta");

    const result = store.history.find((i) => i.kind === "tool-result");
    expect(result).toBeDefined();
  });
});

describe("AgentRuntime — defensive entitlement re-check (Layer B)", () => {
  it("refuses a Pro-only tool when the user has lost entitlement mid-turn", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [{ kind: "tool-call", callId: "c1", toolName: "proOnly", input: {} }],
      [{ kind: "finish" }],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [proOnlyTool] });
    const events = await collect(
      runtime.run({
        ctx: makeCtx({ entitlements: FREE }),
        userMessage: "do the thing",
      })
    );
    const failure = events.find((e) => e.type === "tool.failed");
    expect(failure).toBeDefined();
    if (failure && failure.type === "tool.failed") {
      expect(failure.reason).toBe("unauthorized");
    }
  });
});

describe("AgentRuntime — confirmation gate", () => {
  it("emits confirm.request and pauses for destructive tools", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        {
          kind: "tool-call",
          callId: "del-1",
          toolName: "deleteThing",
          input: { id: "x1" },
        },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [confirmTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "delete x1" }));

    const confirm = events.find((e) => e.type === "confirm.request");
    expect(confirm).toBeDefined();
    if (confirm && confirm.type === "confirm.request") {
      expect(confirm.message).toBe("thing-name");
    }
    expect(events.find((e) => e.type === "tool.completed")).toBeUndefined();
  });
});

describe("AgentRuntime — token usage telemetry (DIE-38 cost cap)", () => {
  it("emits finish.usage on the AgentEvent and persists a usage turn item", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        { kind: "text-delta", text: "Hi" },
        { kind: "finish", usage: { inputTokens: 120, outputTokens: 45 } },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [echoTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "hi" }));

    const finish = events.find((e) => e.type === "finish");
    expect(finish).toBeDefined();
    if (finish && finish.type === "finish") {
      expect(finish.usage?.inputTokens).toBe(120);
      expect(finish.usage?.outputTokens).toBe(45);
    }

    const usageItem = store.history.find((i) => i.kind === "usage");
    expect(usageItem).toBeDefined();
    if (usageItem && usageItem.kind === "usage") {
      expect(usageItem.inputTokens).toBe(120);
      expect(usageItem.outputTokens).toBe(45);
    }
  });

  it("sums usage across multiple LLM steps in a tool loop", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        { kind: "tool-call", callId: "c1", toolName: "echo", input: { value: "x" } },
        { kind: "finish", usage: { inputTokens: 100, outputTokens: 10 } },
      ],
      [
        { kind: "text-delta", text: "Done" },
        { kind: "finish", usage: { inputTokens: 50, outputTokens: 5 } },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [echoTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "go" }));

    const finish = events.find((e) => e.type === "finish");
    expect(finish?.type === "finish" && finish.usage).toBeTruthy();
    if (finish?.type === "finish" && finish.usage) {
      expect(finish.usage.inputTokens).toBe(150);
      expect(finish.usage.outputTokens).toBe(15);
    }

    const usageItems = store.history.filter((i) => i.kind === "usage");
    expect(usageItems).toHaveLength(2);
  });
});

describe("AgentRuntime — refusal telemetry (decision #117)", () => {
  it("appends refusalDetected metadata when the model refuses medical advice without calling a tool", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        {
          kind: "text-delta",
          text:
            "No te puedo asesorar sobre tu diabetes. Consultá con un profesional de la salud.",
        },
        { kind: "finish" },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [echoTool] });
    await collect(
      runtime.run({ ctx: makeCtx(), userMessage: "qué puedo comer si tengo diabetes" })
    );

    const metadata = store.history.find((i) => i.kind === "metadata");
    expect(metadata).toBeDefined();
    if (metadata && metadata.kind === "metadata") {
      expect(metadata.refusalDetected).toBe(true);
    }
  });

  it("does not append refusalDetected when the model calls a tool", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [{ kind: "tool-call", callId: "c1", toolName: "echo", input: { value: "hi" } }],
      [
        {
          // Even if the post-tool ack contains a refusal-ish word, presence of a
          // tool call this turn means it isn't a clean refusal.
          kind: "text-delta",
          text: "Done — you can talk to a healthcare professional if needed.",
        },
        { kind: "finish" },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [echoTool] });
    await collect(runtime.run({ ctx: makeCtx(), userMessage: "use tool" }));

    expect(store.history.find((i) => i.kind === "metadata")).toBeUndefined();
  });

  it("does not append refusalDetected for ordinary cooking prose", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        { kind: "text-delta", text: "I can help with that. " },
        { kind: "text-delta", text: "What are you in the mood for?" },
        { kind: "finish" },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [echoTool] });
    await collect(runtime.run({ ctx: makeCtx(), userMessage: "hi" }));

    expect(store.history.find((i) => i.kind === "metadata")).toBeUndefined();
  });
});

describe("AgentRuntime — proactive filter (Layer A)", () => {
  it("does not surface Pro-gated tools to the LLM for a Free user", async () => {
    const store = new FakeStore();
    let observedToolCount: number | null = null;
    const inspector: LlmProvider = {
      async *stream(req) {
        observedToolCount = req.tools.length;
        yield { kind: "finish" };
      },
    };

    const runtime = new AgentRuntime({
      llm: inspector,
      store,
      tools: [echoTool, proOnlyTool],
    });
    await collect(
      runtime.run({ ctx: makeCtx({ entitlements: FREE }), userMessage: "hi" })
    );
    // echo (no requiresFeature) stays; proOnly (requiresFeature: aiChat) is filtered.
    expect(observedToolCount).toBe(1);
  });
});
