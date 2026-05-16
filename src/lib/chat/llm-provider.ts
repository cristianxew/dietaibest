import type { AnyTool } from "./tools/types";

/**
 * Conversation message — what the runtime feeds the LLM provider on each turn.
 * Tool calls / results are carried as structured turn items so the provider
 * can reconstruct the model-native shape (Anthropic/AI-SDK/etc.) internally.
 */
export type ChatRole = "user" | "assistant" | "system";

export type ConversationTurnItem =
  | { kind: "text"; role: ChatRole; text: string }
  | {
      kind: "tool-call";
      callId: string;
      toolName: string;
      input: unknown;
    }
  | {
      kind: "tool-result";
      callId: string;
      toolName: string;
      result: unknown;
    };

/**
 * The streamed event surface the provider exposes BACK to the runtime. Note
 * this is provider-internal — the runtime wraps these into the public
 * AgentEvent shape (see ./events.ts).
 */
export type ProviderStreamEvent =
  | { kind: "text-delta"; text: string }
  | {
      kind: "tool-call";
      callId: string;
      toolName: string;
      input: unknown;
    }
  | { kind: "finish"; usage?: { inputTokens: number; outputTokens: number } };

export interface LlmStreamRequest {
  systemPrompt: string;
  messages: ConversationTurnItem[];
  tools: ReadonlyArray<AnyTool>;
  /** Stop signal so the runtime can cancel mid-turn (user closed drawer etc.). */
  signal?: AbortSignal;
}

export interface LlmProvider {
  /**
   * Stream a single model turn. The provider is responsible for serialising
   * `messages` into its native shape, presenting `tools` as native tools, and
   * yielding events as they arrive.
   */
  stream(request: LlmStreamRequest): AsyncIterable<ProviderStreamEvent>;
}
