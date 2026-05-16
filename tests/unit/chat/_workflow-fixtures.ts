/**
 * Shared test fixtures for meal-plan workflow tests.
 *
 * Provides properly-typed MockLanguageModelV3 factories that match the
 * LanguageModelV3GenerateResult shape exactly.
 */
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";

/** Properly-typed V3 generate result returning a single text content part */
export function makeTextResult(text: string): LanguageModelV3GenerateResult {
  return {
    content: [{ type: "text", text }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 10, text: 10, reasoning: undefined },
    },
    warnings: [],
  };
}

/** 14 slots: 7 days × 2 meals (breakfast + dinner) */
export function make14Slots(): Array<{ day: number; mealType: string; brief: string }> {
  const slots: Array<{ day: number; mealType: string; brief: string }> = [];
  for (let d = 1; d <= 7; d++) {
    slots.push({ day: d, mealType: "breakfast", brief: `Day ${d} breakfast` });
    slots.push({ day: d, mealType: "dinner", brief: `Day ${d} dinner` });
  }
  return slots;
}

/** Skeleton model that returns 14 slots with a given plan name */
export function makeSkeletonModel(
  slots: ReturnType<typeof make14Slots>,
  planName: string
): MockLanguageModelV3 {
  const responseText = JSON.stringify({ slots, planName });
  return new MockLanguageModelV3({
    provider: "fake",
    modelId: "fake-skeleton",
    doGenerate: async (_opts) => makeTextResult(responseText),
  });
}

/** Fanout model that always succeeds, returning recipeId = recipe-N */
export function makeSuccessFanoutModel(): MockLanguageModelV3 {
  let call = 0;
  return new MockLanguageModelV3({
    provider: "fake",
    modelId: "fake-fanout",
    doGenerate: async (_opts) => makeTextResult(`recipe-${++call}`),
  });
}

/**
 * Fanout model where specific call-indices (0-based) throw a permanent error.
 * All other calls succeed.
 */
export function makeFailFanoutModel(failIndices: Set<number>): MockLanguageModelV3 {
  let call = 0;
  return new MockLanguageModelV3({
    provider: "fake",
    modelId: "fake-fanout",
    doGenerate: async (_opts) => {
      const idx = call++;
      if (failIndices.has(idx)) {
        throw new Error(`Permanent slot failure at index ${idx}`);
      }
      return makeTextResult(`recipe-${idx + 1}`);
    },
  });
}
