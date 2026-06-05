/**
 * LLM model factories for the generateMealPlan workflow.
 *
 * Extracted so tests can mock `getSkeletonModel` / `getFanoutModel` without
 * patching global env vars or touching the real Anthropic provider.
 *
 * Cache control is applied at the call site via `providerOptions` when calling
 * `generateObject` / `generateText` — not at model construction time.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

export function getSkeletonModel(): LanguageModel {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const anthropic = createAnthropic({ apiKey });
  // Claude Sonnet 4.6 — best balance of quality + speed for skeleton planning
  return anthropic("claude-sonnet-4-6");
}

export function getFanoutModel(): LanguageModel {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const anthropic = createAnthropic({ apiKey });
  // Claude Haiku 4.5 — fast + cheap for parallel per-slot recipe resolution
  return anthropic("claude-haiku-4-5");
}
