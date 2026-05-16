import type {
  ConversationTurnItem,
  LlmProvider,
  LlmStreamRequest,
  ProviderStreamEvent,
} from "@/lib/chat/llm-provider";
import type { ConversationStore } from "@/lib/chat/conversation-store";
import type { AgentContext } from "@/lib/chat/context";
import type { Entitlements } from "@/lib/entitlements";
import type { AgentEvent } from "@/lib/chat/events";

export const PRO: Entitlements = {
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

export const FREE: Entitlements = {
  isPro: false,
  limits: {
    savedRecipes: 15,
    recipesCreatedPerMonth: 3,
    importsPerMonth: 0,
    mealPlanTemplates: 1,
    mealPlanDurationDays: 3,
    edamamAnalysesPerMonth: 5,
  },
  features: { aiMealPlan: false, shoppingAutomation: false, recipeImport: false, aiChat: false },
};

export function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: "u1",
    locale: "en",
    conversationId: "c1",
    entitlements: PRO,
    ...overrides,
  };
}

export class FakeStore implements ConversationStore {
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

export class ScriptedProvider implements LlmProvider {
  private turn = 0;
  constructor(private readonly script: ProviderStreamEvent[][]) {}
  async *stream(_req: LlmStreamRequest): AsyncIterable<ProviderStreamEvent> {
    const events = this.script[this.turn] ?? [];
    this.turn++;
    for (const ev of events) yield ev;
  }
}

export async function collect(iter: AsyncIterable<AgentEvent>): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const ev of iter) out.push(ev);
  return out;
}
