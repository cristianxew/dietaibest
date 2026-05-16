import type { ConversationTurnItem } from "./llm-provider";

/**
 * ConversationStore port (DIE-33). Stateless agent runtime depends on this
 * abstraction; in v1 we ship an in-memory adapter. DIE-39 will swap in a
 * durable Postgres adapter without runtime changes.
 */
export interface ConversationStore {
  load(conversationId: string): Promise<ConversationTurnItem[]>;
  append(conversationId: string, items: ConversationTurnItem[]): Promise<void>;
  clear(conversationId: string): Promise<void>;
}
