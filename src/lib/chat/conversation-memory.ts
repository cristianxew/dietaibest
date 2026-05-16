import type { ConversationStore } from "./conversation-store";
import type { ConversationTurnItem } from "./llm-provider";

/**
 * Process-local in-memory conversation store. Resets on server restart. DIE-39
 * replaces this with a durable Postgres-backed implementation. We bind a
 * module-singleton via globalThis so Next.js HMR doesn't clear conversations
 * between hot-reloads in dev.
 */

type Singleton = {
  store: Map<string, ConversationTurnItem[]>;
};

const GLOBAL_KEY = Symbol.for("dietai.chat.conversationMemory");
type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: Singleton };

function getSingleton(): Singleton {
  const g = globalThis as GlobalWithStore;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { store: new Map() };
  }
  return g[GLOBAL_KEY]!;
}

export class MemoryConversationStore implements ConversationStore {
  private readonly state = getSingleton().store;

  async load(conversationId: string): Promise<ConversationTurnItem[]> {
    return this.state.get(conversationId)?.slice() ?? [];
  }

  async append(conversationId: string, items: ConversationTurnItem[]): Promise<void> {
    const current = this.state.get(conversationId) ?? [];
    this.state.set(conversationId, current.concat(items));
  }

  async clear(conversationId: string): Promise<void> {
    this.state.delete(conversationId);
  }
}
