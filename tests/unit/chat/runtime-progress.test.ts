import { describe, it, expect } from "vitest";
import { z } from "zod";

import { AgentRuntime } from "@/lib/chat/runtime";
import type {
  ConversationTurnItem,
  LlmProvider,
  LlmStreamRequest,
  ProviderStreamEvent,
} from "@/lib/chat/llm-provider";
import type { ConversationStore } from "@/lib/chat/conversation-store";
import type { AgentContext } from "@/lib/chat/context";
import type { AnyTool, ToolEmit } from "@/lib/chat/tools/types";
import type { Entitlements } from "@/lib/entitlements";
import type { AgentEvent } from "@/lib/chat/events";

const PRO: Entitlements = {
  isPro: true,
  limits: {
    savedRecipes: Number.POSITIVE_INFINITY,
    recipesCreatedPerMonth: Number.POSITIVE_INFINITY,
    importsPerMonth: Number.POSITIVE_INFINITY,
    mealPlanTemplates: Number.POSITIVE_INFINITY,
    mealPlanDurationDays: Number.POSITIVE_INFINITY,
    edamamAnalysesPerMonth: Number.POSITIVE_INFINITY,
  },
  features: { aiMealPlan: true, shoppingAutomation: true, recipeImport: true, aiChat: true },
};

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: "u1",
    locale: "en",
    conversationId: "c1",
    entitlements: PRO,
    ...overrides,
  };
}

class FakeStore implements ConversationStore {
  public history: ConversationTurnItem[] = [];
  async load() {
    return this.history.slice();
  }
  async append(_id: string, items: ConversationTurnItem[]) {
    this.history.push(...items);
  }
  async clear() {
    this.history = [];
  }
}

class ScriptedProvider implements LlmProvider {
  private turn = 0;
  constructor(private readonly script: ProviderStreamEvent[][]) {}
  async *stream(_req: LlmStreamRequest): AsyncIterable<ProviderStreamEvent> {
    const events = this.script[this.turn] ?? [];
    this.turn++;
    for (const ev of events) yield ev;
  }
}

async function collect(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
}

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
});
