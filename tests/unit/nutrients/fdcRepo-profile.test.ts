import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    fdcCache: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));
vi.mock("@/generated/prisma", () => ({ Prisma: {} }));
vi.mock("@/lib/fdc", () => ({
  fdcFoodsByIds: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { fdcFoodsByIds } from "@/lib/fdc";
import { getFoodsCached } from "@/lib/fdcRepo";

const findMany = vi.mocked(prisma.fdcCache.findMany);
const upsert = vi.mocked(prisma.fdcCache.upsert);
const fetchByIds = vi.mocked(fdcFoodsByIds);

function cacheRow(overrides: Record<string, unknown> = {}) {
  return {
    fdcId: 171688,
    description: "Apples, raw, with skin",
    dataType: "SR Legacy",
    brandOwner: null,
    foodPortions: null,
    foodNutrients: [{ nutrientNumber: "208", amount: 52 }],
    labelNutrients: null,
    nutrientProfile: "core",
    lastFetchedAt: new Date(), // fresh
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchByIds.mockResolvedValue([
    {
      fdcId: 171688,
      description: "Apples, raw, with skin",
      dataType: "SR Legacy",
      foodNutrients: [
        { nutrientNumber: "208", amount: 52 },
        { nutrientNumber: "306", amount: 107 },
      ],
    },
  ]);
  upsert.mockResolvedValue({} as never);
});

describe("getFoodsCached nutrient-profile awareness", () => {
  it("serves fresh core rows from cache under the default profile (no API call)", async () => {
    findMany.mockResolvedValue([cacheRow()] as never);

    const foods = await getFoodsCached([171688]);

    expect(fetchByIds).not.toHaveBeenCalled();
    expect(foods).toHaveLength(1);
    expect(foods[0].fdcId).toBe(171688);
  });

  it("treats fresh core rows as stale when extended profile is required", async () => {
    findMany.mockResolvedValue([cacheRow()] as never);

    await getFoodsCached([171688], { profile: "extended" });

    expect(fetchByIds).toHaveBeenCalledWith([171688]);
  });

  it("serves fresh extended rows from cache when extended profile is required", async () => {
    findMany.mockResolvedValue([
      cacheRow({ nutrientProfile: "extended" }),
    ] as never);

    const foods = await getFoodsCached([171688], { profile: "extended" });

    expect(fetchByIds).not.toHaveBeenCalled();
    expect(foods).toHaveLength(1);
  });

  it("stamps refetched rows as extended in both upsert branches", async () => {
    findMany.mockResolvedValue([] as never);

    await getFoodsCached([171688], { profile: "extended" });

    expect(upsert).toHaveBeenCalledTimes(1);
    const args = upsert.mock.calls[0][0];
    expect(args.update.nutrientProfile).toBe("extended");
    expect(args.create.nutrientProfile).toBe("extended");
  });

  it("still refetches time-stale rows regardless of profile", async () => {
    const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    findMany.mockResolvedValue([
      cacheRow({ nutrientProfile: "extended", lastFetchedAt: oldDate }),
    ] as never);

    await getFoodsCached([171688]);

    expect(fetchByIds).toHaveBeenCalledWith([171688]);
  });
});
