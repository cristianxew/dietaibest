import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool, type LanguageModel, type ModelMessage } from "ai";

import type {
  ConversationTurnItem,
  LlmProvider,
  LlmStreamRequest,
  ProviderStreamEvent,
} from "./llm-provider";
import type { AnyTool } from "./tools/types";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;

export interface AnthropicLlmProviderOptions {
  apiKey?: string;
  model?: string;
  maxOutputTokens?: number;
  /**
   * Optional pre-built LanguageModel — used by unit tests to inject a fake
   * model instead of going through createAnthropic. When provided, apiKey and
   * model are ignored.
   */
  modelOverride?: LanguageModel;
}

/**
 * Real LLM provider backed by Claude Sonnet via @ai-sdk/anthropic.
 *
 * Implements LlmProvider so it slots into AgentRuntime exactly like
 * MockLlmProvider — the runtime owns the tool-dispatch loop, entitlement
 * checks, confirmation gating, and guardrail. The provider's job is to
 * (a) translate our `ConversationTurnItem[]` into AI SDK `ModelMessage[]`,
 * (b) present our tools as AI SDK tools WITHOUT `execute` so the model
 * returns tool calls back up for the runtime to dispatch, and
 * (c) yield text deltas / tool calls / finish over our internal stream
 * event shape.
 */
export class AnthropicLlmProvider implements LlmProvider {
  private readonly model: LanguageModel;
  private readonly maxOutputTokens: number;

  constructor(opts: AnthropicLlmProviderOptions = {}) {
    if (opts.modelOverride) {
      this.model = opts.modelOverride;
    } else {
      const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "AnthropicLlmProvider: ANTHROPIC_API_KEY is not set. Either pass apiKey or use MockLlmProvider for local dev."
        );
      }
      const anthropic = createAnthropic({ apiKey });
      this.model = anthropic(opts.model ?? DEFAULT_MODEL);
    }
    this.maxOutputTokens = opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;
  }

  async *stream(request: LlmStreamRequest): AsyncIterable<ProviderStreamEvent> {
    const messages = toModelMessages(request.messages);
    const tools = toAiSdkTools(request.tools);

    const result = streamText({
      model: this.model,
      system: request.systemPrompt,
      messages,
      tools,
      abortSignal: request.signal,
      maxOutputTokens: this.maxOutputTokens,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          if (part.text) yield { kind: "text-delta", text: part.text };
          break;
        }
        case "tool-call": {
          yield {
            kind: "tool-call",
            callId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
          };
          break;
        }
        case "finish": {
          const usage = part.totalUsage;
          yield {
            kind: "finish",
            usage: usage
              ? {
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
              }
              : undefined,
          };
          break;
        }
        case "error": {
          throw part.error instanceof Error
            ? part.error
            : new Error(
              typeof part.error === "string"
                ? part.error
                : "Anthropic stream error"
            );
        }
        default:
          // text-start, text-end, tool-input-*, reasoning-*, start, start-step,
          // finish-step, raw, source, file — not surfaced to the runtime.
          break;
      }
    }
  }
}

function toAiSdkTools(list: ReadonlyArray<AnyTool>) {
  const out: Record<string, ReturnType<typeof tool>> = {};
  for (const t of list) {
    // Intentionally no `execute` — runtime dispatches tools itself so it can
    // enforce concurrency cap, entitlement re-check, confirmation gating, and
    // guardrail integration. AI SDK leaves tool calls in the stream for us to
    // handle when execute is omitted.
    out[t.name] = tool({
      description: t.description,
      inputSchema: t.inputSchema,
    });
  }
  return out;
}

/**
 * Translate the runtime's append-only `ConversationTurnItem` log into the
 * structured `ModelMessage[]` shape AI SDK expects.
 *
 * The runtime persists each streamed text delta as its own item; we coalesce
 * consecutive text items of the same role into a single message and fold a
 * trailing tool-call (or batch) into the preceding assistant text. Tool
 * results become a dedicated `tool` role message so the model can read them
 * on the next turn.
 *
 * System items are skipped — `streamText({ system })` carries the prompt.
 */
export function toModelMessages(items: ConversationTurnItem[]): ModelMessage[] {
  const out: ModelMessage[] = [];

  type AssistantPart =
    | { type: "text"; text: string }
    | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      input: unknown;
    };

  let buffer:
    | { role: "user"; text: string }
    | { role: "assistant"; parts: AssistantPart[] }
    | null = null;

  const flush = () => {
    if (!buffer) return;
    if (buffer.role === "user") {
      if (buffer.text.length > 0) {
        out.push({ role: "user", content: buffer.text });
      }
    } else {
      const parts = buffer.parts;
      if (parts.length === 0) {
        // nothing to emit
      } else if (parts.length === 1 && parts[0].type === "text") {
        out.push({ role: "assistant", content: parts[0].text });
      } else {
        out.push({ role: "assistant", content: parts });
      }
    }
    buffer = null;
  };

  const pushAssistantPart = (part: AssistantPart) => {
    if (!buffer || buffer.role !== "assistant") {
      flush();
      buffer = { role: "assistant", parts: [] };
    }
    const parts = buffer.parts;
    const last = parts[parts.length - 1];
    if (part.type === "text" && last?.type === "text") {
      last.text += part.text;
    } else {
      parts.push(part);
    }
  };

  for (const item of items) {
    if (item.kind === "metadata" || item.kind === "usage") continue;
    if (item.kind === "text") {
      if (item.role === "system") continue;
      if (item.role === "user") {
        if (!buffer || buffer.role !== "user") {
          flush();
          buffer = { role: "user", text: "" };
        }
        buffer.text += item.text;
      } else {
        pushAssistantPart({ type: "text", text: item.text });
      }
    } else if (item.kind === "tool-call") {
      pushAssistantPart({
        type: "tool-call",
        toolCallId: item.callId,
        toolName: item.toolName,
        input: item.input,
      });
    } else if (item.kind === "tool-result") {
      flush();
      out.push({
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: item.callId,
            toolName: item.toolName,
            output: {
              type: "json",
              value: (item.result ?? null) as never,
            },
          },
        ],
      });
    }
  }
  flush();
  return out;
}
