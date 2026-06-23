import { describe, it, expect, vi } from "vitest";
import { RecipeAnalyzer } from "@/lib/recipe-analyzer";

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

const item = (name: string) => ({ name, grams: 100, description: name });

describe("RecipeAnalyzer.analyze", () => {
  it("parses per-ingredient cooked-state/retention and recipe labels", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(
        JSON.stringify({
          ingredients: [
            { name: "chicken breast", cookedState: "cooked", retentionFactor: 0.9, confidence: 0.95 },
          ],
          dietLabels: ["high-protein"],
          healthLabels: ["gluten-free"],
        })
      ),
    });

    const out = await a.analyze({ title: "Grilled chicken", items: [item("chicken breast")] });

    expect(out.perIngredient).toEqual([
      { name: "chicken breast", cookedState: "cooked", retentionFactor: 0.9, confidence: 0.95, flagged: false },
    ]);
    expect(out.dietLabels).toEqual(["high-protein"]);
    expect(out.healthLabels).toEqual(["gluten-free"]);
  });

  it("forces raw + retention 1.0 + flag when confidence is low (never silently scale)", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(
        JSON.stringify({
          ingredients: [
            { name: "rice", cookedState: "cooked", retentionFactor: 0.5, confidence: 0.2 },
          ],
          dietLabels: [],
          healthLabels: [],
        })
      ),
    });

    const out = await a.analyze({ items: [item("rice")] });

    expect(out.perIngredient[0]).toEqual({
      name: "rice",
      cookedState: "raw",
      retentionFactor: 1.0,
      confidence: 0.2,
      flagged: true,
    });
  });

  it("clamps an out-of-range retention factor into [0,1]", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(
        JSON.stringify({
          ingredients: [
            { name: "spinach", cookedState: "cooked", retentionFactor: 1.4, confidence: 0.9 },
          ],
          dietLabels: [],
          healthLabels: [],
        })
      ),
    });

    const out = await a.analyze({ items: [item("spinach")] });
    expect(out.perIngredient[0].retentionFactor).toBe(1);
  });

  it("returns a safe empty result on transport failure (best-effort, never throws)", async () => {
    const a = new RecipeAnalyzer({
      clientOverride: fakeClient(() => {
        throw new Error("vertex down");
      }),
    });
    const out = await a.analyze({ items: [item("anything")] });
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
