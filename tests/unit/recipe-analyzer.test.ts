import { describe, it, expect, vi } from "vitest";
import {
  RecipeAnalyzer,
  type RecipeAnalyzerItem,
} from "@/lib/recipe-analyzer";

function fakeClient(text: string | (() => never)) {
  return {
    models: {
      generateContent: vi.fn(async () => {
        if (typeof text === "function") text();
        return { text };
      }),
    },
  } as never;
}

const item = (
  name: string,
  candidateIds: number[] = [],
  over: Partial<RecipeAnalyzerItem> = {}
): RecipeAnalyzerItem => ({
  line: `100 g ${name}`,
  qty: 100,
  unit: "g",
  name,
  candidates: candidateIds.map((fdcId) => ({
    fdcId,
    description: name,
    dataType: "SR Legacy",
    kcal: 100,
    protein: 5,
    fat: 1,
    carbs: 10,
  })),
  ...over,
});

describe("RecipeAnalyzer.analyze (RAG resolution)", () => {
  it("selects a candidate, parses grams + cooked-state, and recipe labels", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(
        JSON.stringify({
          ingredients: [
            { name: "salmon", chosenFdcId: 1002, grams: 200, cookedState: "cooked", retentionFactor: 0.9, confidence: 0.95 },
          ],
          dietLabels: ["high-protein"],
          healthLabels: ["pescatarian"],
        })
      ),
    });

    const out = await a.analyze({ title: "Salmon bowl", items: [item("salmon", [1001, 1002])] });

    expect(out.perIngredient[0]).toEqual({
      name: "salmon",
      chosenFdcId: 1002,
      grams: 200,
      cookedState: "cooked",
      retentionFactor: 0.9,
      confidence: 0.95,
      flagged: false,
    });
    expect(out.dietLabels).toEqual(["high-protein"]);
    expect(out.healthLabels).toEqual(["pescatarian"]);
  });

  it("rejects a chosenFdcId that was not among the offered candidates (no invented ids)", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(
        JSON.stringify({
          ingredients: [
            { name: "salmon", chosenFdcId: 9999, grams: 200, cookedState: "raw", retentionFactor: 1, confidence: 0.9 },
          ],
          dietLabels: [],
          healthLabels: [],
        })
      ),
    });
    const out = await a.analyze({ items: [item("salmon", [1001, 1002])] });
    expect(out.perIngredient[0].chosenFdcId).toBeNull();
  });

  it("forces raw + retention 1.0 + no gram override + flag when confidence is low (selection kept)", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(
        JSON.stringify({
          ingredients: [
            { name: "rice", chosenFdcId: 2001, grams: 250, cookedState: "cooked", retentionFactor: 0.5, confidence: 0.2 },
          ],
          dietLabels: [],
          healthLabels: [],
        })
      ),
    });
    const out = await a.analyze({ items: [item("rice", [2001])] });
    expect(out.perIngredient[0]).toEqual({
      name: "rice",
      chosenFdcId: 2001, // selection is a real candidate, kept regardless of confidence
      grams: null, // low-confidence portion not trusted → defer to deterministic
      cookedState: "raw",
      retentionFactor: 1,
      confidence: 0.2,
      flagged: true,
    });
  });

  it("clamps an out-of-range retention factor into [0,1] and drops non-positive grams", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(
        JSON.stringify({
          ingredients: [
            { name: "spinach", chosenFdcId: 3001, grams: 0, cookedState: "cooked", retentionFactor: 1.4, confidence: 0.9 },
          ],
          dietLabels: [],
          healthLabels: [],
        })
      ),
    });
    const out = await a.analyze({ items: [item("spinach", [3001])] });
    expect(out.perIngredient[0].retentionFactor).toBe(1);
    expect(out.perIngredient[0].grams).toBeNull(); // 0 g is not a usable estimate
  });

  it("returns a safe empty result on transport failure (best-effort, never throws)", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(() => {
        throw new Error("vertex down");
      }),
    });
    const out = await a.analyze({ items: [item("anything", [1])] });
    expect(out).toEqual({ perIngredient: [], dietLabels: [], healthLabels: [] });
  });

  it("returns a safe empty result for no items without calling the model", async () => {
    const client = fakeClient("{}");
    const a = new RecipeAnalyzer({ clientOverride: client });
    const out = await a.analyze({ items: [] });
    expect(out).toEqual({ perIngredient: [], dietLabels: [], healthLabels: [] });
    expect(
      (client as never as { models: { generateContent: ReturnType<typeof vi.fn> } })
        .models.generateContent
    ).not.toHaveBeenCalled();
  });
});
