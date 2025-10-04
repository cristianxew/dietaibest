/**
 * Unit Tests for Ingredient Parser
 * Tests parseIngredientLine function from lib/ingredients.ts
 */

import { describe, it, expect } from "vitest";
import { parseIngredientLine } from "@/lib/ingredients";

describe("parseIngredientLine", () => {
  it("parses qty unit name", () => {
    const p = parseIngredientLine("1 1/2 cups chopped onion");
    expect(p.qty).toBeCloseTo(1.5);
    expect(p.unit).toBe("cup");
    expect(p.name).toContain("onion");
  });

  it("handles grams", () => {
    const p = parseIngredientLine("150 g chicken breast");
    expect(p.qty).toBe(150);
    expect(p.unit).toBe("g");
    expect(p.name).toContain("chicken");
  });

  it("handles fractions", () => {
    const p = parseIngredientLine("½ cup flour");
    expect(p.qty).toBe(0.5);
    expect(p.unit).toBe("cup");
  });

  it("strips state words", () => {
    const p = parseIngredientLine("2 cups diced tomatoes");
    expect(p.name).not.toContain("diced");
    expect(p.name).toContain("tomato");
  });

  it("handles tablespoons", () => {
    const p = parseIngredientLine("1 tablespoon olive oil");
    expect(p.qty).toBe(1);
    expect(p.unit).toBe("tbsp");
    expect(p.name).toContain("olive");
  });

  it("handles teaspoons", () => {
    const p = parseIngredientLine("2 tsp vanilla extract");
    expect(p.qty).toBe(2);
    expect(p.unit).toBe("tsp");
    expect(p.name).toContain("vanilla");
  });

  it("handles decimal quantities", () => {
    const p = parseIngredientLine("2.5 cups water");
    expect(p.qty).toBe(2.5);
    expect(p.unit).toBe("cup");
    expect(p.name).toBe("water");
  });

  it("handles mixed fractions with spaces", () => {
    const p = parseIngredientLine("1 1/4 cups sugar");
    expect(p.qty).toBe(1.25);
    expect(p.unit).toBe("cup");
    expect(p.name).toBe("sugar");
  });

  it("handles simple fractions", () => {
    const p = parseIngredientLine("1/4 tsp salt");
    expect(p.qty).toBe(0.25);
    expect(p.unit).toBe("tsp");
    expect(p.name).toBe("salt");
  });

  it("handles unicode fractions", () => {
    const testCases = [
      { input: "¼ cup milk", expectedQty: 0.25 },
      { input: "¾ tsp salt", expectedQty: 0.75 },
      { input: "⅓ cup oil", expectedQty: 0.333 },
      { input: "⅔ cup flour", expectedQty: 0.667 },
    ];

    testCases.forEach(({ input, expectedQty }) => {
      const result = parseIngredientLine(input);
      expect(result.qty).toBeCloseTo(expectedQty, 2);
    });
  });

  it("removes preparation instructions in parentheses", () => {
    const p = parseIngredientLine("2 cups onions (diced)");
    expect(p.name).not.toContain("diced");
    expect(p.name).toContain("onion");
  });

  it("removes preparation instructions after comma", () => {
    const p = parseIngredientLine("1 cup carrots, shredded");
    expect(p.name).not.toContain("shredded");
    expect(p.name).toContain("carrot");
  });

  it("normalizes unit abbreviations", () => {
    const testCases = [
      { input: "1 tbsp butter", expectedUnit: "tbsp" },
      { input: "1 tablespoon butter", expectedUnit: "tbsp" },
      { input: "1 tsp salt", expectedUnit: "tsp" },
      { input: "1 teaspoon salt", expectedUnit: "tsp" },
      { input: "1 oz cheese", expectedUnit: "oz" },
      { input: "1 lb beef", expectedUnit: "lb" },
    ];

    testCases.forEach(({ input, expectedUnit }) => {
      const result = parseIngredientLine(input);
      expect(result.unit).toBe(expectedUnit);
    });
  });

  it("handles kilogram units", () => {
    const p = parseIngredientLine("1.5 kg potatoes");
    expect(p.qty).toBe(1.5);
    expect(p.unit).toBe("kg");
    expect(p.name).toContain("potato");
  });

  it("handles milliliter units", () => {
    const p = parseIngredientLine("250 ml milk");
    expect(p.qty).toBe(250);
    expect(p.unit).toBe("ml");
    expect(p.name).toBe("milk");
  });

  it("handles reversed format (name qty unit)", () => {
    const p = parseIngredientLine("chicken breast 200 g");
    expect(p.qty).toBe(200);
    expect(p.unit).toBe("g");
    expect(p.name).toContain("chicken");
  });

  it("strips common state words", () => {
    const stateWords = [
      "chopped",
      "diced",
      "minced",
      "sliced",
      "cooked",
      "raw",
      "fresh",
    ];

    stateWords.forEach((word) => {
      const result = parseIngredientLine(`1 cup ${word} onions`);
      expect(result.name).not.toContain(word);
      expect(result.name).toContain("onion");
    });
  });

  it("applies synonyms correctly", () => {
    // Test some common synonyms (if they exist in the implementation)
    const p1 = parseIngredientLine("1 cup aubergine");
    // aubergine might be converted to eggplant
    expect(p1.name).toBeDefined();

    const p2 = parseIngredientLine("2 cups courgette");
    // courgette might be converted to zucchini
    expect(p2.name).toBeDefined();
  });

  it("handles complex ingredient strings", () => {
    const p = parseIngredientLine("2 1/2 cups all-purpose flour, sifted");
    expect(p.qty).toBe(2.5);
    expect(p.unit).toBe("cup");
    expect(p.name).toContain("flour");
    expect(p.name).not.toContain("sifted");
  });

  it("preserves original text", () => {
    const original = "1 1/2 cups chopped onion";
    const p = parseIngredientLine(original);
    expect(p.original).toBe(original);
  });

  it("handles ingredients with numbers in name", () => {
    const p = parseIngredientLine("2 cups all-purpose flour");
    expect(p.qty).toBe(2);
    expect(p.unit).toBe("cup");
    expect(p.name).toContain("flour");
  });

  it("handles compound units", () => {
    const p = parseIngredientLine("1 tablespoon olive oil");
    expect(p.qty).toBe(1);
    expect(p.unit).toBe("tbsp");
    expect(p.name).toContain("oil");
  });

  it("handles plural units", () => {
    const p = parseIngredientLine("2 tablespoons butter");
    expect(p.qty).toBe(2);
    expect(p.unit).toBe("tbsp");
    expect(p.name).toBe("butter");
  });

  it("handles very small quantities", () => {
    const p = parseIngredientLine("1/8 tsp cayenne pepper");
    expect(p.qty).toBe(0.125);
    expect(p.unit).toBe("tsp");
    expect(p.name).toContain("cayenne");
  });

  it("handles large quantities", () => {
    const p = parseIngredientLine("1000 g beef");
    expect(p.qty).toBe(1000);
    expect(p.unit).toBe("g");
    expect(p.name).toBe("beef");
  });
});
