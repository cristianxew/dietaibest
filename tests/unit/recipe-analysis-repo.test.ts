import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    recipeAnalysisCache: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  RecipeAnalyzer,
  setRecipeAnalyzerForTest,
  type RecipeAnalysis,
} from "@/lib/recipe-analyzer";
import {
  getRecipeAnalysisCached,
  runRecipeStage2,
  saveRecipeAnalysis,
} from "@/lib/recipe-analysis-repo";

const analysis: RecipeAnalysis = {
  perIngredient: [
    { name: "spinach", chosenFdcId: 168462, grams: 100, cookedState: "cooked", retentionFactor: 0.75, confidence: 0.9, flagged: false },
  ],
  dietLabels: ["low-carb"],
  healthLabels: ["vegan"],
};

const stage2Item = {
  line: "100 g spinach",
  qty: 100,
  unit: "g",
  name: "spinach",
  candidates: [],
};

const fakeAnalyzer = (result: RecipeAnalysis) =>
  ({ analyze: vi.fn(async () => result) }) as unknown as RecipeAnalyzer;

const profile = { calories: 100, protein: 5 } as never;
const coverage = { total: 1, resolved: 1, estimated: 0, unrecognized: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INGREDIENT_LLM_FALLBACK", "1");
  setRecipeAnalyzerForTest(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("runRecipeStage2", () => {
  it("returns a safe empty analysis and skips the LLM when the flag is off", async () => {
    vi.stubEnv("INGREDIENT_LLM_FALLBACK", "0");
    const a = fakeAnalyzer(analysis);
    setRecipeAnalyzerForTest(a);

    const out = await runRecipeStage2({ items: [stage2Item] });
    expect(out).toEqual({ perIngredient: [], dietLabels: [], healthLabels: [] });
    expect((a as unknown as { analyze: ReturnType<typeof vi.fn> }).analyze).not.toHaveBeenCalled();
  });

  it("delegates to the analyzer when the flag is on", async () => {
    setRecipeAnalyzerForTest(fakeAnalyzer(analysis));
    const out = await runRecipeStage2({ items: [stage2Item] });
    expect(out).toEqual(analysis);
  });
});

describe("getRecipeAnalysisCached", () => {
  it("returns null and skips the DB when the flag is off", async () => {
    vi.stubEnv("INGREDIENT_LLM_FALLBACK", "0");
    const out = await getRecipeAnalysisCached("fp1");
    expect(out).toBeNull();
    expect(prisma.recipeAnalysisCache.findUnique).not.toHaveBeenCalled();
  });

  it("returns the mapped cached payload on a hit", async () => {
    vi.mocked(prisma.recipeAnalysisCache.findUnique).mockResolvedValue({
      fingerprint: "fp1",
      servings: 2,
      profileJson: profile,
      stage2Json: analysis,
      coverageJson: coverage,
      lastAnalyzedAt: new Date(),
    } as never);

    const out = await getRecipeAnalysisCached("fp1");
    expect(out).toEqual({ servings: 2, profile, stage2: analysis, coverage });
  });

  it("returns null on a miss", async () => {
    vi.mocked(prisma.recipeAnalysisCache.findUnique).mockResolvedValue(null as never);
    expect(await getRecipeAnalysisCached("nope")).toBeNull();
  });
});

describe("saveRecipeAnalysis", () => {
  it("does nothing (no DB write) when the flag is off", async () => {
    vi.stubEnv("INGREDIENT_LLM_FALLBACK", "0");
    await saveRecipeAnalysis({ fingerprint: "fp1", servings: 2, profile, stage2: analysis, coverage });
    expect(prisma.recipeAnalysisCache.upsert).not.toHaveBeenCalled();
  });

  it("upserts the analysis keyed by fingerprint when the flag is on", async () => {
    await saveRecipeAnalysis({ fingerprint: "fp1", servings: 2, profile, stage2: analysis, coverage });
    expect(prisma.recipeAnalysisCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fingerprint: "fp1" },
        create: expect.objectContaining({
          fingerprint: "fp1",
          servings: 2,
          profileJson: profile,
          stage2Json: analysis,
          coverageJson: coverage,
        }),
      })
    );
  });

  it("never throws when the DB write fails (best-effort cache)", async () => {
    vi.mocked(prisma.recipeAnalysisCache.upsert).mockRejectedValue(new Error("db down") as never);
    await expect(
      saveRecipeAnalysis({ fingerprint: "fp1", servings: 2, profile, stage2: analysis, coverage })
    ).resolves.toBeUndefined();
  });
});
