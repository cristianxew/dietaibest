import { describe, it, expect, beforeEach, afterEach } from "vitest";

import {
  computeCostUsd,
  isCostCapEnforced,
  CHAT_COST_CAP_USD,
  ANTHROPIC_INPUT_USD_PER_MTOK,
  ANTHROPIC_OUTPUT_USD_PER_MTOK,
  getMonthlyAiCostUsd,
} from "@/lib/chat/cost-cap";

describe("computeCostUsd", () => {
  it("returns 0 for 0 tokens", () => {
    expect(computeCostUsd(0, 0)).toBe(0);
  });

  it("scales linearly with input + output tokens using the Anthropic per-Mtok rates", () => {
    // 1_000_000 input tokens = $ANTHROPIC_INPUT_USD_PER_MTOK
    expect(computeCostUsd(1_000_000, 0)).toBeCloseTo(
      ANTHROPIC_INPUT_USD_PER_MTOK,
      6
    );
    // 1_000_000 output tokens = $ANTHROPIC_OUTPUT_USD_PER_MTOK
    expect(computeCostUsd(0, 1_000_000)).toBeCloseTo(
      ANTHROPIC_OUTPUT_USD_PER_MTOK,
      6
    );
  });

  it("treats negative or NaN inputs as 0 (defensive)", () => {
    expect(computeCostUsd(-100, -50)).toBe(0);
    expect(computeCostUsd(Number.NaN, 0)).toBe(0);
  });
});

describe("isCostCapEnforced — feature flag", () => {
  const original = process.env.CHAT_COST_CAP_ENFORCED;

  beforeEach(() => {
    delete process.env.CHAT_COST_CAP_ENFORCED;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CHAT_COST_CAP_ENFORCED;
    else process.env.CHAT_COST_CAP_ENFORCED = original;
  });

  it("defaults to false (shadow mode) per AC", () => {
    expect(isCostCapEnforced()).toBe(false);
  });

  it("returns true only for the exact string 'true'", () => {
    process.env.CHAT_COST_CAP_ENFORCED = "true";
    expect(isCostCapEnforced()).toBe(true);
    process.env.CHAT_COST_CAP_ENFORCED = "1";
    expect(isCostCapEnforced()).toBe(false);
    process.env.CHAT_COST_CAP_ENFORCED = "TRUE";
    expect(isCostCapEnforced()).toBe(false);
  });
});

describe("decideCostCap — block decision", () => {
  it("flags reached but does NOT block in shadow mode (enforced=false)", async () => {
    const { decideCostCap } = await import("@/lib/chat/cost-cap");
    const d = decideCostCap(10, 5, false);
    expect(d.reached).toBe(true);
    expect(d.shouldBlock).toBe(false);
  });

  it("blocks only when reached AND enforced", async () => {
    const { decideCostCap } = await import("@/lib/chat/cost-cap");
    expect(decideCostCap(10, 5, true)).toEqual({
      reached: true,
      shouldBlock: true,
    });
    expect(decideCostCap(2, 5, true)).toEqual({
      reached: false,
      shouldBlock: false,
    });
  });
});

describe("CHAT_COST_CAP_USD constant", () => {
  it("is a finite positive number", () => {
    expect(CHAT_COST_CAP_USD).toBeGreaterThan(0);
    expect(Number.isFinite(CHAT_COST_CAP_USD)).toBe(true);
  });
});

describe("getMonthlyAiCostUsd", () => {
  /**
   * Minimal fake to exercise the SQL aggregate the function builds. Mirrors
   * the Prisma `message.aggregate({_sum, where})` shape; the actual call goes
   * through user-scoped conversations.
   */
  it("returns 0 when there are no token rows for the user this month", async () => {
    const fake = {
      message: {
        aggregate: async () => ({
          _sum: { inputTokens: null, outputTokens: null },
        }),
      },
    };
    const cost = await getMonthlyAiCostUsd(
      fake as unknown as Parameters<typeof getMonthlyAiCostUsd>[0],
      "u1"
    );
    expect(cost).toBe(0);
  });

  it("sums token columns scoped to the user's conversations for the current month", async () => {
    let receivedWhere: Record<string, unknown> | null = null;
    const fake = {
      message: {
        aggregate: async (args: {
          where: Record<string, unknown>;
          _sum: { inputTokens: true; outputTokens: true };
        }) => {
          receivedWhere = args.where;
          return { _sum: { inputTokens: 500_000, outputTokens: 200_000 } };
        },
      },
    };

    const cost = await getMonthlyAiCostUsd(
      fake as unknown as Parameters<typeof getMonthlyAiCostUsd>[0],
      "u1"
    );

    expect(cost).toBeCloseTo(
      computeCostUsd(500_000, 200_000),
      6
    );
    expect(receivedWhere).not.toBeNull();
    const where = receivedWhere as unknown as Record<string, unknown>;
    // Must scope by the user's conversations (join via conversation.userId).
    // Prisma uses { is: { ... } } for to-one relation filters.
    expect(where.conversation).toMatchObject({ is: { userId: "u1" } });
    // Must filter by current month start
    expect(where.createdAt).toBeDefined();
  });
});
