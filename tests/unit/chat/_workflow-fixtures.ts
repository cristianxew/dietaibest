/**
 * Shared test fixtures for meal-plan workflow tests.
 *
 * Provides properly-typed MockLanguageModelV3 factories that match the
 * LanguageModelV3GenerateResult shape exactly.
 *
 * Contract: the fanout step asks the model for a candidate INDEX (structured
 * output) and maps it to a real recipe id from the `candidates` workflow input.
 * Fixtures therefore answer with `{"index": k}`, never with an id string.
 */
import { randomUUID } from "node:crypto";
import { MockLanguageModelV3 } from "ai/test";
import type { LanguageModelV3GenerateResult } from "@ai-sdk/provider";
import type { CandidateRecipe } from "@/lib/meal-plan/generation-candidates";

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

export const DEFAULT_POOL_SIZE = 6;

/** N candidate recipes with real UUIDs — the pool the fanout step selects from. */
export function makeCandidates(n: number = DEFAULT_POOL_SIZE): CandidateRecipe[] {
  return Array.from({ length: n }, (_, i) => ({
    id: randomUUID(),
    title: `Library recipe ${i + 1}`,
    description: null,
    tags: [],
    calories: 400 + i * 25,
    protein: 30,
    carbs: 40,
    fat: 15,
  }));
}

export interface WorkflowInputFixture {
  days: number;
  mealsPerDay: Array<"breakfast" | "lunch" | "dinner" | "snack">;
  userId: string;
  candidates: CandidateRecipe[];
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  dietary?: string[];
  allergies?: string[];
}

/** Workflow inputData for a 7-day × 2-meal run backed by a candidate pool. */
export function makeWorkflowInput(
  overrides: Partial<WorkflowInputFixture> = {}
): WorkflowInputFixture {
  return {
    days: 7,
    mealsPerDay: ["breakfast", "dinner"],
    userId: "u1",
    candidates: makeCandidates(),
    ...overrides,
  };
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

/** Fanout model that always succeeds, picking candidate index = call % poolSize */
export function makeSuccessFanoutModel(poolSize: number = DEFAULT_POOL_SIZE): MockLanguageModelV3 {
  let call = 0;
  return new MockLanguageModelV3({
    provider: "fake",
    modelId: "fake-fanout",
    doGenerate: async (_opts) => makeTextResult(JSON.stringify({ index: call++ % poolSize })),
  });
}

/**
 * Fanout model where specific call-indices (0-based) throw a permanent error.
 * All other calls succeed with a valid candidate index.
 */
export function makeFailFanoutModel(
  failIndices: Set<number>,
  poolSize: number = DEFAULT_POOL_SIZE
): MockLanguageModelV3 {
  let call = 0;
  return new MockLanguageModelV3({
    provider: "fake",
    modelId: "fake-fanout",
    doGenerate: async (_opts) => {
      const idx = call++;
      if (failIndices.has(idx)) {
        throw new Error(`Permanent slot failure at index ${idx}`);
      }
      return makeTextResult(JSON.stringify({ index: idx % poolSize }));
    },
  });
}
