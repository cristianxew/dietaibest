import { prisma } from "@/lib/prisma";

import { AgentRuntime } from "./runtime";
import { AnthropicLlmProvider } from "./llm-anthropic";
import { MockLlmProvider } from "./llm-mock";
import { PrismaConversationStore } from "./conversation-prisma";
import type { ConversationStore } from "./conversation-store";
import type { LlmProvider } from "./llm-provider";
import { allTools } from "./tools/index";

/**
 * Module-singleton runtime for the in-app chat route. Process-local; safe to
 * share across requests because the runtime itself is stateless.
 *
 * Provider selection:
 *  - ANTHROPIC_API_KEY present → real Claude (Sonnet 4.6 by default,
 *    override via CHAT_LLM_MODEL).
 *  - Otherwise → MockLlmProvider, so dev/test setups without a key keep the
 *    pipeline runnable end-to-end. The fallback is logged once.
 *
 * Store: PrismaConversationStore (DIE-39). Durable per-user, per-conversation
 * history. The runtime is stateless so a single shared store instance is fine.
 */

const GLOBAL_KEY = Symbol.for("dietai.chat.runtime");
type GlobalWithRuntime = typeof globalThis & { [GLOBAL_KEY]?: AgentRuntime };

function selectProvider(): LlmProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey && apiKey.trim().length > 0) {
    return new AnthropicLlmProvider({
      apiKey,
      model: process.env.CHAT_LLM_MODEL || undefined,
    });
  }
  console.warn(
    "[chat] ANTHROPIC_API_KEY not set — falling back to MockLlmProvider."
  );
  return new MockLlmProvider();
}

export function getRuntime(): AgentRuntime {
  const g = globalThis as GlobalWithRuntime;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = new AgentRuntime({
      llm: selectProvider(),
      store: getStore(),
      tools: allTools,
      toolConcurrency: 4,
      maxToolLoops: 5,
    });
  }
  return g[GLOBAL_KEY]!;
}

export function getStore(): ConversationStore {
  return new PrismaConversationStore(prisma);
}
