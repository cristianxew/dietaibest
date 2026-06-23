import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Prisma is mocked to a tiny in-memory double — fdcRepo imports it as a named
// (`{ prisma }`) export, so provide both named + default to match the module.
// `vi.hoisted` keeps the double accessible inside the hoisted vi.mock factory.
const { fdcSearchCache } = vi.hoisted(() => ({
  fdcSearchCache: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { fdcSearchCache },
  default: { fdcSearchCache },
}));

// Keep the real fdc module (fdcRepo also reads constants/types from it) but stub
// the network search so we can drive its return shape and failures.
vi.mock("@/lib/fdc", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/fdc")>();
  return { ...actual, fdcSearch: vi.fn() };
});

import {
  searchFoodsCached,
  normalizeSearchQuery,
} from "@/lib/fdcRepo";
import { fdcSearch, type FdcSearchFood } from "@/lib/fdc";

const mockedFdcSearch = vi.mocked(fdcSearch);

const MS_DAY = 24 * 60 * 60 * 1000;

const ONION: FdcSearchFood = {
  fdcId: 1,
  description: "Onion, raw",
  dataType: "Foundation",
};
const ONION_SR: FdcSearchFood = {
  fdcId: 2,
  description: "Onions, raw",
  dataType: "SR Legacy",
};

/** A cache row with the given freshness. */
function cacheRow(over: Record<string, unknown> = {}) {
  return {
    query: "onion",
    results: [ONION],
    lastFetchedAt: new Date(),
    ...over,
  };
}

describe("searchFoodsCached — caches FDC ingredient search by normalized query", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fdcSearchCache.findUnique.mockReset();
    fdcSearchCache.upsert.mockReset();
    mockedFdcSearch.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("cache miss → hits USDA, upserts the result, returns the foods", async () => {
    fdcSearchCache.findUnique.mockResolvedValue(null);
    fdcSearchCache.upsert.mockResolvedValue({});
    mockedFdcSearch.mockResolvedValue({ foods: [ONION, ONION_SR] });

    const foods = await searchFoodsCached("onion");

    expect(foods).toEqual([ONION, ONION_SR]);
    expect(mockedFdcSearch).toHaveBeenCalledOnce();
    expect(fdcSearchCache.upsert).toHaveBeenCalledOnce();
    const upsertArg = fdcSearchCache.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({ query: "onion" });
    expect(upsertArg.create.query).toBe("onion");
    expect(upsertArg.create.results).toEqual([ONION, ONION_SR]);
  });

  it("fresh hit → serves the cache and NEVER calls USDA", async () => {
    fdcSearchCache.findUnique.mockResolvedValue(
      cacheRow({ results: [ONION], lastFetchedAt: new Date() })
    );

    const foods = await searchFoodsCached("onion");

    expect(foods).toEqual([ONION]);
    expect(mockedFdcSearch).not.toHaveBeenCalled();
    expect(fdcSearchCache.upsert).not.toHaveBeenCalled();
  });

  it("stale hit (older than the 90-day TTL) → refetches and upserts", async () => {
    fdcSearchCache.findUnique.mockResolvedValue(
      cacheRow({ results: [ONION], lastFetchedAt: new Date(Date.now() - 100 * MS_DAY) })
    );
    fdcSearchCache.upsert.mockResolvedValue({});
    mockedFdcSearch.mockResolvedValue({ foods: [ONION_SR] });

    const foods = await searchFoodsCached("onion");

    expect(foods).toEqual([ONION_SR]);
    expect(mockedFdcSearch).toHaveBeenCalledOnce();
    expect(fdcSearchCache.upsert).toHaveBeenCalledOnce();
  });

  it("normalizes the query (lowercase + collapse whitespace) for the cache key", async () => {
    expect(normalizeSearchQuery("  Yellow  Onion ")).toBe("yellow onion");

    fdcSearchCache.findUnique.mockResolvedValue(null);
    fdcSearchCache.upsert.mockResolvedValue({});
    mockedFdcSearch.mockResolvedValue({ foods: [ONION] });

    await searchFoodsCached("  Yellow  Onion ");

    expect(fdcSearchCache.findUnique).toHaveBeenCalledWith({
      where: { query: "yellow onion" },
    });
    // The live search is issued with the normalized term too (keeps key↔term in
    // sync), preferring pure single-ingredient data types first (ADR 0004).
    expect(mockedFdcSearch).toHaveBeenCalledWith("yellow onion", [
      "Foundation",
      "SR Legacy",
    ]);
    expect(fdcSearchCache.upsert.mock.calls[0][0].create.query).toBe("yellow onion");
  });

  it("no Foundation/SR or Survey hits → falls back to a Branded search (ADR 0004)", async () => {
    fdcSearchCache.findUnique.mockResolvedValue(null);
    fdcSearchCache.upsert.mockResolvedValue({});
    const BRANDED: FdcSearchFood = {
      fdcId: 9,
      description: "PROTEIN BAR",
      dataType: "Branded",
    };
    // Foundation/SR empty, then Survey empty, then Branded supplies the hit.
    mockedFdcSearch
      .mockResolvedValueOnce({ foods: [] })
      .mockResolvedValueOnce({ foods: [] })
      .mockResolvedValueOnce({ foods: [BRANDED] });

    const foods = await searchFoodsCached("obscure protein bar");

    expect(foods).toEqual([BRANDED]);
    expect(mockedFdcSearch).toHaveBeenNthCalledWith(1, "obscure protein bar", [
      "Foundation",
      "SR Legacy",
    ]);
    expect(mockedFdcSearch).toHaveBeenNthCalledWith(2, "obscure protein bar", [
      "Survey (FNDDS)",
    ]);
    expect(mockedFdcSearch).toHaveBeenNthCalledWith(3, "obscure protein bar", [
      "Branded",
    ]);
  });

  it("USDA error with a stale row present → serves stale (rate-limit resilience), no throw", async () => {
    fdcSearchCache.findUnique.mockResolvedValue(
      cacheRow({ results: [ONION], lastFetchedAt: new Date(Date.now() - 100 * MS_DAY) })
    );
    mockedFdcSearch.mockRejectedValue(new Error("USDA 429 rate limited"));

    const foods = await searchFoodsCached("onion");

    expect(foods).toEqual([ONION]);
    expect(fdcSearchCache.upsert).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("USDA error with nothing cached → rethrows so the caller's existing handling kicks in", async () => {
    fdcSearchCache.findUnique.mockResolvedValue(null);
    mockedFdcSearch.mockRejectedValue(new Error("USDA 500"));

    await expect(searchFoodsCached("onion")).rejects.toThrow("USDA 500");
    expect(fdcSearchCache.upsert).not.toHaveBeenCalled();
  });

  it("blank query → returns [] without touching the DB or USDA", async () => {
    const foods = await searchFoodsCached("   ");

    expect(foods).toEqual([]);
    expect(fdcSearchCache.findUnique).not.toHaveBeenCalled();
    expect(mockedFdcSearch).not.toHaveBeenCalled();
  });
});
