import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingredientNameCache: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  IngredientCanonicalizer,
  setIngredientCanonicalizerForTest,
  type MacroEstimate,
} from "@/lib/ingredient-canonicalizer";
import { canonicalizeCached, getMacroEstimates } from "@/lib/ingredient-name-repo";

const fakeCanon = (map: Record<string, string | null>) =>
  ({
    canonicalize: vi.fn(async (names: string[]) => {
      const m = new Map<string, string | null>();
      for (const n of names) if (n in map) m.set(n, map[n]);
      return m;
    }),
  }) as unknown as IngredientCanonicalizer;

const fakeEstimator = (map: Record<string, MacroEstimate | null>) =>
  ({
    estimateMacros: vi.fn(async (names: string[]) => {
      const m = new Map<string, MacroEstimate | null>();
      for (const n of names) if (n in map) m.set(n, map[n]);
      return m;
    }),
  }) as unknown as IngredientCanonicalizer;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INGREDIENT_LLM_FALLBACK", "1");
  setIngredientCanonicalizerForTest(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("canonicalizeCached", () => {
  it("returns an empty map and skips the DB when the flag is off", async () => {
    vi.stubEnv("INGREDIENT_LLM_FALLBACK", "0");
    const out = await canonicalizeCached(["łosoś"]);
    expect(out.size).toBe(0);
    expect(prisma.ingredientNameCache.findMany).not.toHaveBeenCalled();
  });

  it("serves a cache hit without calling the LLM", async () => {
    vi.mocked(prisma.ingredientNameCache.findMany).mockResolvedValue([
      { key: "łosoś", canonical: "salmon", lastFetchedAt: new Date() },
    ] as never);
    const canon = fakeCanon({});
    setIngredientCanonicalizerForTest(canon);

    const out = await canonicalizeCached(["łosoś"]);
    expect(out.get("łosoś")).toBe("salmon");
    expect(canon.canonicalize).not.toHaveBeenCalled();
  });

  it("does NOT cache a name the LLM failed to return (no poisoning on transient failure)", async () => {
    vi.mocked(prisma.ingredientNameCache.findMany).mockResolvedValue([] as never);
    setIngredientCanonicalizerForTest(fakeCanon({})); // empty map = LLM failure
    const out = await canonicalizeCached(["komosa ryżowa"]);
    expect(out.get("komosa ryżowa")).toBeNull(); // unresolved this run
    expect(prisma.ingredientNameCache.upsert).not.toHaveBeenCalled(); // but NOT cached
  });

  it("calls the LLM for a miss and upserts the result", async () => {
    vi.mocked(prisma.ingredientNameCache.findMany).mockResolvedValue([] as never);
    setIngredientCanonicalizerForTest(fakeCanon({ "komosa ryżowa": "quinoa" }));

    const out = await canonicalizeCached(["komosa ryżowa"]);
    expect(out.get("komosa ryżowa")).toBe("quinoa");
    expect(prisma.ingredientNameCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "komosa ryżowa" },
        create: { key: "komosa ryżowa", canonical: "quinoa" },
      })
    );
  });
});

describe("getMacroEstimates", () => {
  const miso: MacroEstimate = {
    kcal: 199,
    protein: 12,
    fat: 6,
    carbs: 26,
    fiber: 5,
  };

  it("returns an empty map and skips the LLM when the flag is off", async () => {
    vi.stubEnv("INGREDIENT_LLM_FALLBACK", "0");
    const est = fakeEstimator({ "miso paste": miso });
    setIngredientCanonicalizerForTest(est);

    const out = await getMacroEstimates(["miso paste"]);
    expect(out.size).toBe(0);
    expect(
      (est as unknown as { estimateMacros: ReturnType<typeof vi.fn> })
        .estimateMacros
    ).not.toHaveBeenCalled();
  });

  it("returns per-100g estimates from the LLM when the flag is on", async () => {
    setIngredientCanonicalizerForTest(fakeEstimator({ "miso paste": miso }));

    const out = await getMacroEstimates(["miso paste"]);
    expect(out.get("miso paste")).toEqual(miso);
  });
});
