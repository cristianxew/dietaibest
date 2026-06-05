import type { PrismaClient } from "@/generated/prisma";

/**
 * Cost cap for the in-app AI chat agent (DIE-38).
 *
 * Operational throttle, NOT a paywall. Derived per-user-per-month from the
 * `Message.inputTokens` / `Message.outputTokens` columns populated by the
 * agent runtime (see runtime.ts → conversation-prisma.ts). Same shape as
 * `getUsage` in src/lib/entitlements.ts — no new ledger table.
 *
 * Shadow mode by default (`isCostCapEnforced()` returns false unless the
 * `CHAT_COST_CAP_ENFORCED` env is exactly the string `"true"`). The PRD
 * requires shadow telemetry for ≥1 week before enforcement to validate the
 * cap is generous enough.
 *
 * Pricing reflects the Anthropic public rates for the model used by the
 * orquestador (Claude Sonnet 4.6 via @ai-sdk/anthropic). The Mastra meal-plan
 * fan-out runs Haiku, which is cheaper — using the Sonnet rate here is a
 * conservative upper bound for v1.
 */

// Public Anthropic pricing — USD per million tokens.
export const ANTHROPIC_INPUT_USD_PER_MTOK = 3;
export const ANTHROPIC_OUTPUT_USD_PER_MTOK = 15;

// Cap per user per calendar month, USD. Generous starting value; tune from
// shadow-mode telemetry once ≥1 week of real usage data is in.
export const CHAT_COST_CAP_USD = 5;

export function computeCostUsd(
  inputTokens: number,
  outputTokens: number
): number {
  const inT =
    Number.isFinite(inputTokens) && inputTokens > 0 ? inputTokens : 0;
  const outT =
    Number.isFinite(outputTokens) && outputTokens > 0 ? outputTokens : 0;
  return (
    (inT / 1_000_000) * ANTHROPIC_INPUT_USD_PER_MTOK +
    (outT / 1_000_000) * ANTHROPIC_OUTPUT_USD_PER_MTOK
  );
}

export function isCostCapEnforced(): boolean {
  return process.env.CHAT_COST_CAP_ENFORCED === "true";
}

function startOfCurrentMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

/**
 * Returns the first day of the NEXT calendar month — used for the
 * `resetsOn` field surfaced to the user when the cap is reached.
 */
export function nextMonthResetDate(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

/**
 * Pure helper for the chat-route gate. Lets the route make the
 * reached/block decision without re-implementing the comparison logic.
 */
export function decideCostCap(
  currentCostUsd: number,
  capUsd: number,
  enforced: boolean
): { reached: boolean; shouldBlock: boolean } {
  const reached = currentCostUsd >= capUsd;
  return { reached, shouldBlock: reached && enforced };
}

export async function getMonthlyAiCostUsd(
  prisma: Pick<PrismaClient, "message">,
  userId: string
): Promise<number> {
  const monthStart = startOfCurrentMonth();
  const sums = await prisma.message.aggregate({
    where: {
      createdAt: { gte: monthStart },
      conversation: { is: { userId } },
    },
    _sum: { inputTokens: true, outputTokens: true },
  });
  const inputTokens = sums._sum.inputTokens ?? 0;
  const outputTokens = sums._sum.outputTokens ?? 0;
  return computeCostUsd(inputTokens, outputTokens);
}
