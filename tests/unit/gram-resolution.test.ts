import { describe, expect, it } from "vitest";
import { resolveGramWeight } from "@/lib/gram-resolution";
import type { FdcFood } from "@/lib/fdc";
import type { ParsedIngredient } from "@/lib/ingredients";

function food(opts: Partial<FdcFood> = {}): FdcFood {
  return {
    fdcId: 1,
    description: "test food",
    dataType: "Foundation",
    ...opts,
  };
}

function parsed(p: Partial<ParsedIngredient> & { unit: string }): ParsedIngredient {
  return { original: "x", name: "x", qty: 1, ...p };
}

describe("resolveGramWeight — strategy ladder", () => {
  it("uses the quantity directly when the unit is already grams (confidence 1.0)", () => {
    const r = resolveGramWeight(parsed({ qty: 250, unit: "g", name: "rice" }), food());
    expect(r.grams).toBe(250);
    expect(r.confidence).toBe(1.0);
  });

  it("prefers USDA food portions over the density table (confidence 0.9)", () => {
    const f = food({
      foodPortions: [
        { amount: 1, gramWeight: 113, measureUnit: { name: "cup", abbreviation: "cup" } },
      ],
    });
    const r = resolveGramWeight(parsed({ qty: 2, unit: "cup", name: "rice" }), f);
    expect(r.grams).toBe(226); // 2 × 113, not the density-table cup weight
    expect(r.confidence).toBe(0.9);
  });

  it("uses the density table on an exact name match (confidence 0.7)", () => {
    const r = resolveGramWeight(parsed({ qty: 1, unit: "cup", name: "flour" }), food());
    expect(r.grams).toBe(120); // flour: cup → 120g
    expect(r.confidence).toBe(0.7);
  });

  it("matches a density entry by longest whole-word (extra virgin olive oil → olive oil)", () => {
    const r = resolveGramWeight(
      parsed({ qty: 1, unit: "tbsp", name: "extra virgin olive oil" }),
      food()
    );
    expect(r.grams).toBe(13.5); // olive oil tbsp, not the generic 15
    expect(r.confidence).toBe(0.6);
  });

  it("does NOT cross-match a key that is only a substring, not a whole word (saltine ≠ salt)", () => {
    const r = resolveGramWeight(
      parsed({ qty: 1, unit: "tbsp", name: "saltine crackers" }),
      food()
    );
    // Falls through to the registry generic conversion (1 tbsp = 14.787 ml ≈
    // 14.787 g as water), NOT salt's 18g/tbsp.
    expect(r.grams).toBeCloseTo(14.787, 3);
    expect(r.confidence).toBe(0.5);
  });

  it("falls back to a generic conversion for an unknown ingredient with a known unit (0.5)", () => {
    const r = resolveGramWeight(
      parsed({ qty: 2, unit: "oz", name: "exotic mystery root" }),
      food()
    );
    expect(r.grams).toBeCloseTo(56.7); // 2 × 28.35
    expect(r.confidence).toBe(0.5);
  });

  it("resolves 'fl oz' via the registry generic conversion (regression: was missing → assumed grams)", () => {
    const r = resolveGramWeight(
      parsed({ qty: 2, unit: "fl oz", name: "exotic mystery liquid" }),
      food()
    );
    expect(r.grams).toBeCloseTo(2 * 29.574, 2); // 1 fl oz = 29.574 ml as water
    expect(r.confidence).toBe(0.5);
  });

  it("assumes grams as the last resort for an unknown unit (0.3)", () => {
    const r = resolveGramWeight(
      parsed({ qty: 7, unit: "blob", name: "exotic mystery root" }),
      food()
    );
    expect(r.grams).toBe(7);
    expect(r.confidence).toBe(0.3);
  });
});

describe("resolveGramWeight — count-unit defaults (no more assume-1g)", () => {
  it("uses a typical weight for a can when nothing else resolves it (not 1g)", () => {
    const r = resolveGramWeight(
      parsed({ qty: 1, unit: "can", name: "chickpeas" }),
      food()
    );
    expect(r.grams).toBe(400); // standard can default, not the assume-grams 1g
    expect(r.confidence).toBeGreaterThan(0.3);
    expect(r.confidence).toBeLessThan(0.6);
  });

  it("uses a typical weight for a bunch", () => {
    const r = resolveGramWeight(
      parsed({ qty: 2, unit: "bunch", name: "exotic greens" }),
      food()
    );
    expect(r.grams).toBe(300); // 2 × 150g
  });

  it("still prefers an ingredient-specific density entry over the count default", () => {
    const r = resolveGramWeight(
      parsed({ qty: 3, unit: "clove", name: "garlic" }),
      food()
    );
    expect(r.grams).toBe(9); // garlic clove = 3g (density 0.7), not a generic default
    expect(r.confidence).toBe(0.7);
  });
});

describe("resolveGramWeight — generic 'piece' falls back to a single USDA portion", () => {
  it("uses the food's only portion for a piece/sztuka (bread slice 28g), not assume-1g", () => {
    const f = food({
      foodPortions: [
        { amount: 1, gramWeight: 28, measureUnit: { name: "slice", abbreviation: "slice" } },
      ],
    });
    // "2 sztuki bread" → unit normalizes to "piece"; the only portion is a slice.
    const r = resolveGramWeight(parsed({ qty: 2, unit: "piece", name: "bread" }), f);
    expect(r.grams).toBe(56); // 2 × 28g, not 2g
    expect(r.confidence).toBe(0.6);
  });

  it("divides gramWeight by the portion amount (2 slices = 56g → 28g per piece)", () => {
    const f = food({
      foodPortions: [
        { amount: 2, gramWeight: 56, measureUnit: { name: "slice", abbreviation: "slice" } },
      ],
    });
    const r = resolveGramWeight(parsed({ qty: 1, unit: "piece", name: "bread" }), f);
    expect(r.grams).toBe(28);
    expect(r.confidence).toBe(0.6);
  });

  it("does NOT guess when the food has multiple portions (ambiguous → assume-grams)", () => {
    const f = food({
      foodPortions: [
        { amount: 1, gramWeight: 28, measureUnit: { name: "slice", abbreviation: "slice" } },
        { amount: 1, gramWeight: 200, measureUnit: { name: "cup", abbreviation: "cup" } },
      ],
    });
    const r = resolveGramWeight(parsed({ qty: 1, unit: "piece", name: "bread" }), f);
    expect(r.confidence).toBe(0.3);
    expect(r.grams).toBe(1);
  });

  it("leaves a density-table piece (egg) on the density value, not the single portion", () => {
    // measureUnit "cup" does NOT normalize to piece, so step 2 won't match it;
    // density (step 4) must still win over the single-portion fallback (step 4.5).
    const f = food({
      foodPortions: [
        { amount: 1, gramWeight: 999, measureUnit: { name: "cup", abbreviation: "cup" } },
      ],
    });
    const r = resolveGramWeight(parsed({ qty: 1, unit: "piece", name: "egg" }), f);
    expect(r.grams).toBe(50); // egg density (0.7), not the 999g portion
    expect(r.confidence).toBe(0.7);
  });
});

describe("density table — expanded common-ingredient coverage", () => {
  // Each ingredient/unit pair below should resolve via the density table
  // (confidence 0.7), not the generic water-density fallback (0.5) or the
  // assume-grams last resort (0.3). One representative pair per category.
  const cases: Array<[name: string, unit: string, grams: number]> = [
    ["honey", "tbsp", 21],
    ["maple syrup", "tbsp", 20],
    ["egg", "piece", 50],
    ["yogurt", "cup", 245],
    ["sour cream", "tbsp", 14],
    ["cream cheese", "tbsp", 14.5],
    ["cheddar", "cup", 113],
    ["parmesan", "tbsp", 5],
    ["oats", "cup", 90],
    ["cornstarch", "tbsp", 8],
    ["cocoa powder", "tbsp", 5.4],
    ["peanut butter", "tbsp", 16],
    ["almond", "cup", 143],
    ["baking powder", "tsp", 4.6],
    ["soy sauce", "tbsp", 16],
    ["vinegar", "tbsp", 15],
    ["lemon juice", "tbsp", 15],
    ["mayonnaise", "tbsp", 13.8],
    ["chickpeas", "cup", 164],
    ["lentils", "cup", 198],
    ["quinoa", "cup", 185],
    ["banana", "piece", 118],
  ];

  it.each(cases)(
    "resolves %s by %s via the density table (%dg)",
    (name, unit, grams) => {
      const r = resolveGramWeight(parsed({ qty: 1, unit, name }), food());
      expect(r.grams).toBeCloseTo(grams, 2);
      expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    }
  );
});
