import { describe, it, expect } from "vitest";
import { z } from "zod";

import { AgentRuntime } from "@/lib/chat/runtime";
import type { AnyTool, ToolEmit } from "@/lib/chat/tools/types";
import type { AgentEvent } from "@/lib/chat/events";

import { makeCtx, FakeStore, ScriptedProvider, collect } from "./_fixtures";

// A tool that calls emit three times before resolving
const progressToolSchema = z.object({ slots: z.number() });
const progressTool: AnyTool = {
  name: "slottedTool",
  description: "Emits slot progress events.",
  inputSchema: progressToolSchema,
  statusKey: "mealplan.generating",
  async execute(input, _ctx, emit?: ToolEmit) {
    const count = (input as { slots: number }).slots;
    for (let i = 1; i <= count; i++) {
      emit?.({ statusKey: "mealplan.slot", payload: { slot: { n: i, m: count } } });
    }
    return { ok: true, data: { done: true } };
  },
};

// A tool that never calls emit
const silentToolSchema = z.object({ value: z.string() });
const silentTool: AnyTool = {
  name: "silentTool",
  description: "Never emits progress.",
  inputSchema: silentToolSchema,
  statusKey: "tool.invoked",
  async execute(input) {
    return { ok: true, data: { echoed: (input as { value: string }).value } };
  },
};

// A tool that emits 2 progress events and then throws
const throwingToolSchema = z.object({ dummy: z.string().optional() });
const throwingTool: AnyTool = {
  name: "throwingTool",
  description: "Emits 2 progress events then throws.",
  inputSchema: throwingToolSchema,
  statusKey: "mealplan.generating",
  async execute(_input, _ctx, emit?: ToolEmit) {
    emit?.({ statusKey: "mealplan.slot", payload: { slot: { n: 1, m: 2 } } });
    emit?.({ statusKey: "mealplan.slot", payload: { slot: { n: 2, m: 2 } } });
    throw new Error("simulated failure");
  },
};

// A tool that pushes its final progress event in the same microtask tick as resolution
const tailDrainToolSchema = z.object({ dummy: z.string().optional() });
const tailDrainTool: AnyTool = {
  name: "tailDrainTool",
  description: "Emits progress in the same microtask as resolution.",
  inputSchema: tailDrainToolSchema,
  statusKey: "mealplan.generating",
  async execute(_input, _ctx, emit?: ToolEmit) {
    // simulate async work
    await Promise.resolve();
    // emit and resolve in the same microtask
    emit?.({ statusKey: "mealplan.slot", payload: { slot: { n: 5, m: 5 } } });
    return { ok: true, data: {} };
  },
};

describe("AgentRuntime — tool.progress streaming", () => {
  it("emits three tool.progress events before tool.completed when execute calls emit three times", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        {
          kind: "tool-call",
          callId: "slot-run-1",
          toolName: "slottedTool",
          input: { slots: 3 },
        },
      ],
      [
        { kind: "text-delta", text: "Done." },
        { kind: "finish" },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [progressTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "run slots" }));

    const progressEvents = events.filter((e) => e.type === "tool.progress");
    const completedEvents = events.filter((e) => e.type === "tool.completed");

    // Must have exactly 3 tool.progress events
    expect(progressEvents).toHaveLength(3);

    // All progress events must carry the correct callId and toolName
    for (const ev of progressEvents) {
      if (ev.type === "tool.progress") {
        expect(ev.callId).toBe("slot-run-1");
        expect(ev.toolName).toBe("slottedTool");
        expect(ev.statusKey).toBe("mealplan.slot");
      }
    }

    // Progress events must carry incremental slot payloads in order
    const payloads = progressEvents
      .filter((e): e is Extract<AgentEvent, { type: "tool.progress" }> => e.type === "tool.progress")
      .map((e) => e.payload?.slot);
    expect(payloads).toEqual([
      { n: 1, m: 3 },
      { n: 2, m: 3 },
      { n: 3, m: 3 },
    ]);

    // tool.completed must exist
    expect(completedEvents).toHaveLength(1);

    // All three progress events must appear BEFORE tool.completed
    const completedIndex = events.findIndex((e) => e.type === "tool.completed");
    const lastProgressIndex = events.reduce(
      (acc, ev, idx) => (ev.type === "tool.progress" ? idx : acc),
      -1
    );
    expect(lastProgressIndex).toBeLessThan(completedIndex);
  });

  it("emits NO tool.progress events when execute never calls emit", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        { kind: "tool-call", callId: "silent-1", toolName: "silentTool", input: { value: "hello" } },
      ],
      [
        { kind: "text-delta", text: "Echo." },
        { kind: "finish" },
      ],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [silentTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "run silent" }));

    const progressEvents = events.filter((e) => e.type === "tool.progress");
    expect(progressEvents).toHaveLength(0);

    // Normal sequence still intact
    const types = events.map((e) => e.type);
    expect(types).toContain("tool.invoked");
    expect(types).toContain("tool.completed");
    expect(types).toContain("finish");
  });

  it("emits progress events in the order they were emitted", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        {
          kind: "tool-call",
          callId: "order-check",
          toolName: "slottedTool",
          input: { slots: 5 },
        },
      ],
      [{ kind: "finish" }],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [progressTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "order test" }));

    const slotNs = events
      .filter((e): e is Extract<AgentEvent, { type: "tool.progress" }> => e.type === "tool.progress")
      .map((e) => e.payload?.slot?.n);

    expect(slotNs).toEqual([1, 2, 3, 4, 5]);
  });

  it("preserves partial progress events when the tool emits then throws", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        {
          kind: "tool-call",
          callId: "throw-run-1",
          toolName: "throwingTool",
          input: {},
        },
      ],
      [{ kind: "finish" }],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [throwingTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "emit then throw" }));

    // The 2 tool.progress events must be present (not dropped)
    const progressEvents = events.filter((e) => e.type === "tool.progress");
    expect(progressEvents).toHaveLength(2);

    // A tool.failed event must follow
    const failedEvent = events.find((e) => e.type === "tool.failed");
    expect(failedEvent).toBeDefined();

    // No tool.completed
    expect(events.find((e) => e.type === "tool.completed")).toBeUndefined();

    // Both progress events appear before tool.failed
    const failedIndex = events.findIndex((e) => e.type === "tool.failed");
    const lastProgressIndex = events.reduce(
      (acc, ev, idx) => (ev.type === "tool.progress" ? idx : acc),
      -1
    );
    expect(lastProgressIndex).toBeLessThan(failedIndex);
  });

  it("captures a progress event emitted in the same microtask as resolution (tail-drain)", async () => {
    const store = new FakeStore();
    const provider = new ScriptedProvider([
      [
        {
          kind: "tool-call",
          callId: "tail-drain-1",
          toolName: "tailDrainTool",
          input: {},
        },
      ],
      [{ kind: "finish" }],
    ]);

    const runtime = new AgentRuntime({ llm: provider, store, tools: [tailDrainTool] });
    const events = await collect(runtime.run({ ctx: makeCtx(), userMessage: "tail drain test" }));

    // The 1 progress event must be captured before tool.completed
    const progressEvents = events.filter((e) => e.type === "tool.progress");
    expect(progressEvents).toHaveLength(1);

    const progressEvent = progressEvents[0];
    if (progressEvent.type === "tool.progress") {
      expect(progressEvent.payload?.slot).toEqual({ n: 5, m: 5 });
    }

    // tool.completed must be present
    const completedEvent = events.find((e) => e.type === "tool.completed");
    expect(completedEvent).toBeDefined();

    // Progress event appears before tool.completed
    const completedIndex = events.findIndex((e) => e.type === "tool.completed");
    const progressIndex = events.findIndex((e) => e.type === "tool.progress");
    expect(progressIndex).toBeLessThan(completedIndex);
  });
});
