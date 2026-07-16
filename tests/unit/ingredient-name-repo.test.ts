import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingredientNameCache: { findMany: vi.fn(), upsert: vi.fn() },
    ingredientEstimateCache: { findMany: vi.fn(), upsert: vi.fn() },
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

  it("leaves a name the LLM failed to return UNRESOLVED (undefined), never cached", async () => {
    vi.mocked(prisma.ingredientNameCache.findMany).mockResolvedValue([] as never);
    setIngredientCanonicalizerForTest(fakeCanon({})); // empty map = LLM failure
    const out = await canonicalizeCached(["komosa ryżowa"]);
    // Bug #1 fix: a transient miss is `undefined` (absent), NOT `null`. `null`
    // means "confirmed not a food" → the caller would zero it as UNRECOGNIZED;
    // `undefined` means "use the raw name", so a Vertex blip degrades to raw
    // matching like flag-off does.
    expect(out.has("komosa ryżowa")).toBe(false);
    expect(out.get("komosa ryżowa")).toBeUndefined();
    expect(prisma.ingredientNameCache.upsert).not.toHaveBeenCalled(); // and NOT cached
  });

  it("distinguishes a confirmed not-food (null) from an unresolved miss (undefined)", async () => {
    vi.mocked(prisma.ingredientNameCache.findMany).mockResolvedValue([] as never);
    // "posiłek 1" is an explicit non-food (LLM returns null); "obscurefood" is
    // absent from the LLM response → a transient miss.
    setIngredientCanonicalizerForTest(fakeCanon({ "posiłek 1": null }));

    const out = await canonicalizeCached(["posiłek 1", "obscurefood"]);
    expect(out.get("posiłek 1")).toBeNull(); // confirmed not-a-food
    expect(out.get("obscurefood")).toBeUndefined(); // unresolved → match the raw name
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

  it("returns an empty map and skips the LLM + DB when the flag is off", async () => {
    vi.stubEnv("INGREDIENT_LLM_FALLBACK", "0");
    const est = fakeEstimator({ "miso paste": miso });
    setIngredientCanonicalizerForTest(est);

    const out = await getMacroEstimates(["miso paste"]);
    expect(out.size).toBe(0);
    expect(
      (est as unknown as { estimateMacros: ReturnType<typeof vi.fn> })
        .estimateMacros
    ).not.toHaveBeenCalled();
    expect(prisma.ingredientEstimateCache.findMany).not.toHaveBeenCalled();
  });

  it("serves a cache hit without calling the LLM", async () => {
    vi.mocked(prisma.ingredientEstimateCache.findMany).mockResolvedValue([
      { name: "miso paste", ...miso, lastFetchedAt: new Date() },
    ] as never);
    const est = fakeEstimator({});
    setIngredientCanonicalizerForTest(est);

    const out = await getMacroEstimates(["miso paste"]);
    expect(out.get("miso paste")).toEqual(miso);
    expect(
      (est as unknown as { estimateMacros: ReturnType<typeof vi.fn> })
        .estimateMacros
    ).not.toHaveBeenCalled();
  });

  it("calls the LLM for a miss and upserts the estimate", async () => {
    vi.mocked(prisma.ingredientEstimateCache.findMany).mockResolvedValue(
      [] as never
    );
    setIngredientCanonicalizerForTest(fakeEstimator({ "miso paste": miso }));

    const out = await getMacroEstimates(["miso paste"]);
    expect(out.get("miso paste")).toEqual(miso);
    expect(prisma.ingredientEstimateCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: "miso paste" },
        create: { name: "miso paste", ...miso },
      })
    );
  });

  it("does NOT cache a null estimate (no poisoning on a declined/transient estimate)", async () => {
    vi.mocked(prisma.ingredientEstimateCache.findMany).mockResolvedValue(
      [] as never
    );
    setIngredientCanonicalizerForTest(fakeEstimator({ obscurething: null }));

    const out = await getMacroEstimates(["obscurething"]);
    expect(out.get("obscurething")).toBeNull();
    expect(prisma.ingredientEstimateCache.upsert).not.toHaveBeenCalled();
  });
});
