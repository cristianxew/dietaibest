import type { PrismaClient } from "@/generated/prisma";

/**
 * Daily cap for multimodal image imports (DIE-41).
 *
 * Cost guard, not a paywall. Counts MultimodalImportEvent rows for the user
 * created since 00:00 UTC of the current calendar day. Calendar-day boundary
 * (vs 24-hour rolling window) was chosen because it's simpler to explain to
 * users ("resets at midnight UTC") and the implementation is one aggregate
 * query with no time math beyond `startOfDay`.
 *
 * All attempts count — pending, success, failure. Reason: every attempt
 * consumes Gemini API tokens, and counting only successes would let users
 * upload junk photos for free and game the limit.
 *
 * Hard-enforced from day one (no shadow mode) because Gemma 4 31B inference
 * costs real money per request and the cap (10/day) is generous.
 */

export const MULTIMODAL_DAILY_CAP = 10;

function startOfTodayUtc(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0,
      0,
      0,
      0
    )
  );
}

/** First instant of the NEXT UTC day — surfaced as `resetsOn` when blocked. */
export function nextDayResetDate(now: Date = new Date()): Date {
  return new Date(startOfTodayUtc(now).getTime() + 24 * 60 * 60 * 1000);
}

export async function getMultimodalImportCountToday(
  prisma: Pick<PrismaClient, "multimodalImportEvent">,
  userId: string
): Promise<number> {
  return prisma.multimodalImportEvent.count({
    where: {
      userId,
      createdAt: { gte: startOfTodayUtc() },
    },
  });
}
