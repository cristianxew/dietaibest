import { describe, it, expect } from "vitest";

import {
  MULTIMODAL_DAILY_CAP,
  getMultimodalImportCountToday,
  nextDayResetDate,
} from "@/lib/chat/multimodal-cap";

describe("MULTIMODAL_DAILY_CAP constant", () => {
  it("is a finite positive integer", () => {
    expect(MULTIMODAL_DAILY_CAP).toBeGreaterThan(0);
    expect(Number.isInteger(MULTIMODAL_DAILY_CAP)).toBe(true);
  });
});

describe("nextDayResetDate", () => {
  it("returns the next UTC day midnight", () => {
    const now = new Date(Date.UTC(2026, 4, 17, 14, 30, 0));
    const next = nextDayResetDate(now);
    expect(next.getUTCFullYear()).toBe(2026);
    expect(next.getUTCMonth()).toBe(4); // May (0-indexed)
    expect(next.getUTCDate()).toBe(18);
    expect(next.getUTCHours()).toBe(0);
    expect(next.getUTCMinutes()).toBe(0);
  });

  it("rolls forward at month boundary", () => {
    const now = new Date(Date.UTC(2026, 4, 31, 23, 59, 59));
    const next = nextDayResetDate(now);
    expect(next.getUTCMonth()).toBe(5); // June
    expect(next.getUTCDate()).toBe(1);
  });
});

describe("getMultimodalImportCountToday", () => {
  it("returns the count Prisma reports, scoped to the user since startOfTodayUtc", async () => {
    let receivedWhere: Record<string, unknown> | null = null;
    const fake = {
      multimodalImportEvent: {
        count: async (args: { where: Record<string, unknown> }) => {
          receivedWhere = args.where;
          return 4;
        },
      },
    };

    const count = await getMultimodalImportCountToday(
      fake as unknown as Parameters<typeof getMultimodalImportCountToday>[0],
      "u1"
    );

    expect(count).toBe(4);
    expect(receivedWhere).not.toBeNull();
    const where = receivedWhere as unknown as Record<string, unknown>;
    expect(where.userId).toBe("u1");
    // createdAt filter must be a `gte` clause; the value is the startOfToday Date.
    const createdAt = where.createdAt as { gte: Date } | undefined;
    expect(createdAt?.gte).toBeInstanceOf(Date);
    // startOfTodayUtc is at 00:00:00.000 UTC
    expect(createdAt!.gte.getUTCHours()).toBe(0);
    expect(createdAt!.gte.getUTCMinutes()).toBe(0);
    expect(createdAt!.gte.getUTCSeconds()).toBe(0);
  });

  it("returns 0 when there are no events for the user today", async () => {
    const fake = {
      multimodalImportEvent: {
        count: async () => 0,
      },
    };
    const count = await getMultimodalImportCountToday(
      fake as unknown as Parameters<typeof getMultimodalImportCountToday>[0],
      "u1"
    );
    expect(count).toBe(0);
  });
});
