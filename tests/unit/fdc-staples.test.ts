import { describe, expect, it } from "vitest";
import { stapleFdcId, STAPLE_FDC_IDS } from "@/lib/fdc-staples";

describe("fdc-staples · stapleFdcId", () => {
  it("returns the curated id for an exact staple name", () => {
    expect(stapleFdcId("egg")).toBe(171287);
    expect(stapleFdcId("onion")).toBe(170000);
    expect(stapleFdcId("olive oil")).toBe(171413);
  });

  it("is case- and whitespace-insensitive", () => {
    expect(stapleFdcId("  Egg ")).toBe(171287);
  });

  it("resolves common plurals to the singular key (-s and -es)", () => {
    expect(stapleFdcId("eggs")).toBe(171287);
    expect(stapleFdcId("onions")).toBe(170000);
    expect(stapleFdcId("tomatoes")).toBe(stapleFdcId("tomato"));
  });

  it("resolves -ies plurals back to the -y singular key", () => {
    // "cherries" -> "cherry", "strawberries" -> "strawberry". The old -s/-es
    // strip produced "cherri"/"strawberri" and missed the staple entirely.
    expect(stapleFdcId("cherries")).toBe(stapleFdcId("cherry"));
    expect(stapleFdcId("strawberries")).toBe(stapleFdcId("strawberry"));
    expect(stapleFdcId("strawberries")).toBe(167762);
  });

  it("resolves chili / red pepper flakes to the red-pepper spice (not wheat cereal)", () => {
    const cayenne = 170932; // Spices, pepper, red or cayenne
    expect(stapleFdcId("chili flakes")).toBe(cayenne);
    expect(stapleFdcId("chilli flakes")).toBe(cayenne);
    expect(stapleFdcId("chilli flake")).toBe(cayenne);
    expect(stapleFdcId("red pepper flakes")).toBe(cayenne);
    expect(stapleFdcId("cayenne")).toBe(cayenne);
  });

  it("includes a broad set of newly curated staples", () => {
    expect(stapleFdcId("mango")).toBe(169910);
    expect(stapleFdcId("kale")).toBe(168421);
    expect(stapleFdcId("salmon")).toBe(173686);
    expect(stapleFdcId("almond flour")).toBe(2261420);
    expect(stapleFdcId("cinnamon")).toBe(171320);
  });

  it("returns null for a non-staple", () => {
    expect(stapleFdcId("dragon fruit")).toBeNull();
    expect(stapleFdcId("")).toBeNull();
  });

  it("does NOT include dry/cooked-ambiguous cup-measured grains", () => {
    // Excluded on purpose — density assumes cooked, USDA food is dry, so pinning
    // them would overcount. Search + ranking handle these instead.
    for (const k of ["rice", "pasta", "oats", "quinoa", "couscous"]) {
      expect(STAPLE_FDC_IDS[k]).toBeUndefined();
    }
  });

  it("maps every value to a positive integer fdcId", () => {
    for (const id of Object.values(STAPLE_FDC_IDS)) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
    }
  });
});
