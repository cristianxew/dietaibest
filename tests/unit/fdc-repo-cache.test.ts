import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Prisma is mocked to a tiny in-memory double — fdcRepo imports it as a named
// (`{ prisma }`) export, so provide both named + default to match the module.
// `vi.hoisted` keeps the double accessible inside the hoisted vi.mock factory.
const { fdcCache } = vi.hoisted(() => ({
  fdcCache: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { fdcCache },
  default: { fdcCache },
}));

// Keep the real fdc module (fdcRepo also reads MICRO_NUTRIENT_NUMBERS from it)
// but stub the network call so we can drive its return shape.
vi.mock("@/lib/fdc", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/fdc")>();
  return { ...actual, fdcFoodsByIds: vi.fn() };
});

import { getFoodsCached } from "@/lib/fdcRepo";
import { fdcFoodsByIds } from "@/lib/fdc";

const mockedFdcFoodsByIds = vi.mocked(fdcFoodsByIds);

/** A fresh, full-profile cache row (carries micro #307 → not legacy/stale). */
function freshCacheRow(over: Record<string, unknown> = {}) {
  return {
    fdcId: 1,
    description: "Onion, raw",
    dataType: "Foundation",
    brandOwner: null,
    foodPortions: [],
    foodNutrients: [{ nutrientNumber: "307", amount: 10 }],
    labelNutrients: null,
    lastFetchedAt: new Date(),
    ...over,
  };
}

describe("getFoodsCached — non-array fetch result is handled, not swallowed", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fdcCache.findMany.mockReset();
    fdcCache.upsert.mockReset();
    mockedFdcFoodsByIds.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps cached survivors and warns the unresolved count instead of dropping the batch as a generic error", async () => {
    fdcCache.findMany.mockResolvedValue([freshCacheRow()]);
    // The USDA bug: a non-iterable object where an array is expected.
    mockedFdcFoodsByIds.mockResolvedValue({} as never);

    const result = await getFoodsCached([1, 2]);

    // Fresh cached id 1 survives; id 2 is simply unresolved — not a crash.
    expect(result.map((f) => f.fdcId)).toEqual([1]);
    // A non-array must never reach the upsert loop.
    expect(fdcCache.upsert).not.toHaveBeenCalled();
    // The failure is surfaced as a warning that names the unresolved id —
    // NOT swallowed by the catch as a generic "Error fetching" console.error.
    expect(errorSpy).not.toHaveBeenCalled();
    const warned = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(warned).toMatch(/unresolved/i);
    expect(warned).toContain("2");
  });

  it("degrades gracefully when the fetch rejects: keeps survivors, reports the unresolved id", async () => {
    fdcCache.findMany.mockResolvedValue([freshCacheRow()]);
    mockedFdcFoodsByIds.mockRejectedValue(new Error("USDA 429 rate limited"));

    const result = await getFoodsCached([1, 2]);

    expect(result.map((f) => f.fdcId)).toEqual([1]);
    expect(fdcCache.upsert).not.toHaveBeenCalled();
    const warned = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(warned).toMatch(/unresolved/i);
    expect(warned).toContain("2");
  });

  it("warns only for ids the API omits from an otherwise-valid array response", async () => {
    fdcCache.findMany.mockResolvedValue([]); // nothing cached
    fdcCache.upsert.mockResolvedValue({});
    // id 3 is silently omitted by the API
    mockedFdcFoodsByIds.mockResolvedValue([
      { fdcId: 1, description: "Onion, raw", dataType: "Foundation" },
      { fdcId: 2, description: "Garlic, raw", dataType: "Foundation" },
    ] as never);

    const result = await getFoodsCached([1, 2, 3]);

    expect(result.map((f) => f.fdcId)).toEqual([1, 2]);
    expect(fdcCache.upsert).toHaveBeenCalledTimes(2);
    const warned = warnSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(warned).toMatch(/1 of 3 requested/i);
    expect(warned).toContain("3");
  });
});
