import { describe, it, expect } from "vitest";
import type { NutrientVector } from "@/lib/nutrients/extract";
import { computeInsights } from "@/lib/nutrients/insights";

/** Per-100g vectors from USDA SR Legacy */
const banana: NutrientVector = {
  kcal: 89,
  protein: 1.09,
  fiber: 2.6,
  sugar: 12.2,
  potassium: 358,
  vitaminC: 8.7,
};

const apple: NutrientVector = {
  kcal: 52,
  protein: 0.26,
  fiber: 2.4,
  sugar: 10.4,
  potassium: 107,
  vitaminC: 4.6,
};

describe("computeInsights — golden case banana vs apple", () => {
  it("fires exactly the potassium insight (3× more, positive, winner a)", () => {
    const insights = computeInsights(banana, apple);

    expect(insights).toHaveLength(1);
    const potassium = insights[0];
    expect(potassium.nutrient).toBe("potassium");
    expect(potassium.winner).toBe("a");
    expect(potassium.kind).toBe("timesMore");
    expect(potassium.sentiment).toBe("positive");
    expect(potassium.times).toBe(3); // 358/107 = 3.35 → ≥3 rounds to integer
  });
});

describe("computeInsights — rule mechanics", () => {
  it("skips a rule when either side is missing the nutrient (missing ≠ 0)", () => {
    const insights = computeInsights(
      { potassium: 400 },
      { kcal: 50 } // potassium unknown
    );
    expect(insights).toHaveLength(0);
  });

  it("emits onlyOneHas when one side has effectively none", () => {
    const insights = computeInsights(
      { vitaminD: 11 },
      { vitaminD: 0 }
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].kind).toBe("onlyOneHas");
    expect(insights[0].winner).toBe("a");
  });

  it("marks limit-nutrient wins as caution on the HIGHER side", () => {
    const insights = computeInsights({ sodium: 50 }, { sodium: 400 });
    expect(insights).toHaveLength(1);
    expect(insights[0].winner).toBe("b");
    expect(insights[0].sentiment).toBe("caution");
    expect(insights[0].kind).toBe("timesMore");
  });

  it("falls back to moreBy when diff is large but ratio is small", () => {
    const insights = computeInsights({ sodium: 800 }, { sodium: 950 });
    expect(insights).toHaveLength(1);
    expect(insights[0].kind).toBe("moreBy");
    expect(insights[0].diff).toBe(150);
    expect(insights[0].winner).toBe("b");
  });

  it("stays silent below the absolute-difference floor", () => {
    expect(computeInsights({ fiber: 2.6 }, { fiber: 2.4 })).toHaveLength(0);
    expect(computeInsights({ sugar: 12.2 }, { sugar: 10.4 })).toHaveLength(0);
  });

  it("rounds times to 1 decimal under 3 and integers from 3 up", () => {
    const small = computeInsights({ protein: 11.7 }, { protein: 5 });
    expect(small[0].times).toBe(2.3); // ratio 2.34

    const big = computeInsights({ protein: 25 }, { protein: 5 });
    expect(big[0].times).toBe(5);
  });

  it("orders insights by significance (most lopsided first)", () => {
    const a: NutrientVector = { potassium: 600, vitaminC: 30 };
    const b: NutrientVector = { potassium: 200, vitaminC: 2 };
    const insights = computeInsights(a, b);
    expect(insights.map((i) => i.nutrient)).toEqual([
      "vitaminC", // 15× beats 3×
      "potassium",
    ]);
  });

  it("supports custom rule configs", () => {
    const insights = computeInsights(
      { kcal: 300 },
      { kcal: 100 },
      [{ nutrient: "kcal", ratioMin: 1.5, minAbsDiff: 50 }]
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].nutrient).toBe("kcal");
  });
});
