import { describe, expect, it } from "vitest";
import { parseIngredientLine } from "@/lib/ingredients";

describe("parseIngredientLine · attached quantity+unit (P0 regression)", () => {
  it("splits '200ml milk' into qty 200, unit ml", () => {
    const p = parseIngredientLine("200ml milk");
    expect(p.qty).toBe(200);
    expect(p.unit).toBe("ml");
    expect(p.name).toBe("milk");
  });

  it("splits '1tbsp olive oil' into qty 1, unit tbsp", () => {
    const p = parseIngredientLine("1tbsp olive oil");
    expect(p.qty).toBe(1);
    expect(p.unit).toBe("tbsp");
    expect(p.name).toBe("olive oil");
  });

  it("splits '100g flour' into qty 100, unit g", () => {
    const p = parseIngredientLine("100g flour");
    expect(p.qty).toBe(100);
    expect(p.unit).toBe("g");
    expect(p.name).toBe("flour");
  });

  it("does NOT split when the trailing letters are not a known unit ('7up')", () => {
    const p = parseIngredientLine("7up");
    expect(p.unit).not.toBe("up");
    // Treated as a no-unit count item, name preserved.
    expect(p.name).toContain("7up");
  });

  it("does NOT mangle a percentage prefix ('100% orange juice')", () => {
    const p = parseIngredientLine("100% orange juice");
    expect(p.name).toContain("orange juice");
  });
});

describe("parseIngredientLine · multi-word unit (P0 regression)", () => {
  it("parses '1 fl oz vanilla' into unit 'fl oz', name vanilla", () => {
    const p = parseIngredientLine("1 fl oz vanilla");
    expect(p.qty).toBe(1);
    expect(p.unit).toBe("fl oz");
    expect(p.name).toBe("vanilla");
  });

  it("does not over-consume a normal single-word unit ('2 cups onions')", () => {
    const p = parseIngredientLine("2 cups onions");
    expect(p.qty).toBe(2);
    expect(p.unit).toBe("cup");
    expect(p.name).toBe("onions");
  });
});

describe("parseIngredientLine · non-unit first word is NOT a unit (P0 regression)", () => {
  // The bug: pattern 1 greedily took the word after the quantity as the unit,
  // even when it was a food word. "1 chicken breast" became unit "chicken",
  // name "breast" → the gram ladder fell to "assume 1 = 1g", zeroing the
  // protein of a whole chicken breast. Only a KNOWN unit may fill the unit slot.
  it("parses '1 chicken breast' as 1 piece of chicken breast", () => {
    const p = parseIngredientLine("1 chicken breast");
    expect(p.qty).toBe(1);
    expect(p.unit).toBe("piece");
    expect(p.name).toBe("chicken breast");
  });

  it("parses '1 bell pepper' as 1 piece of bell pepper", () => {
    const p = parseIngredientLine("1 bell pepper");
    expect(p.qty).toBe(1);
    expect(p.unit).toBe("piece");
    expect(p.name).toBe("bell pepper");
  });

  it("parses '2 green onions' as 2 pieces (green not a unit)", () => {
    const p = parseIngredientLine("2 green onions");
    expect(p.qty).toBe(2);
    expect(p.unit).toBe("piece");
    expect(p.name).toContain("onion");
  });

  it("strips a size adjective in the unit slot ('3 large eggs' → eggs)", () => {
    const p = parseIngredientLine("3 large eggs");
    expect(p.qty).toBe(3);
    expect(p.unit).toBe("piece");
    expect(p.name).toBe("eggs");
  });

  it("still treats a real known unit as the unit ('150 g chicken breast')", () => {
    const p = parseIngredientLine("150 g chicken breast");
    expect(p.qty).toBe(150);
    expect(p.unit).toBe("g");
    expect(p.name).toBe("chicken breast");
  });
});

describe("parseIngredientLine · non-ASCII (Polish) units parse (P0 regression)", () => {
  // The unit slot was matched with [a-zA-Z]+, so Polish units carrying
  // diacritics (łyżka = tbsp, łyżeczka = tsp, ząbki = cloves) never matched and
  // collapsed to "piece" — wrong gram weight for a supported language.
  it("recognizes 'łyżki' (Polish tablespoon)", () => {
    const p = parseIngredientLine("2 łyżki mąki");
    expect(p.qty).toBe(2);
    expect(p.unit).toBe("tbsp");
  });

  it("recognizes 'łyżeczka' (Polish teaspoon)", () => {
    const p = parseIngredientLine("1 łyżeczka soli");
    expect(p.unit).toBe("tsp");
  });

  it("recognizes 'ząbki' (Polish cloves)", () => {
    const p = parseIngredientLine("3 ząbki czosnku");
    expect(p.qty).toBe(3);
    expect(p.unit).toBe("clove");
  });
});

describe("parseIngredientLine · does NOT translate (LLM owns canonicalization)", () => {
  // ADR 0003: the parser must NOT collapse names via the SYNONYMS table — that
  // over-collapses multi-word names ("sos sojowy" → "sauce", "pasta miso" →
  // "pasta") into generic-but-wrong matches that pass the guard and pre-empt the
  // LLM canonicalizer. The parser now returns the raw (state-stripped) name and
  // the LLM canonicalizer is the single normalizer.
  it("keeps a single-word foreign name raw ('cebolla', not 'onion')", () => {
    const p = parseIngredientLine("100 g cebolla");
    expect(p.name).toBe("cebolla");
  });

  it("does not over-collapse a multi-word name ('sos sojowy' stays intact)", () => {
    const p = parseIngredientLine("15 ml sos sojowy");
    expect(p.name).toBe("sos sojowy");
  });

  it("keeps an English name untouched ('chicken breast')", () => {
    const p = parseIngredientLine("150 g chicken breast");
    expect(p.name).toBe("chicken breast");
  });
});

describe("parseIngredientLine · existing behavior still holds", () => {
  it("parses spaced qty/unit/name", () => {
    const p = parseIngredientLine("150 g chicken breast");
    expect(p).toMatchObject({ qty: 150, unit: "g", name: "chicken breast" });
  });

  it("parses count items with no unit", () => {
    const p = parseIngredientLine("2 eggs");
    expect(p).toMatchObject({ qty: 2, unit: "piece", name: "eggs" });
  });
});
