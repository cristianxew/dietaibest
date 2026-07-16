import { describe, expect, it } from "vitest";
import {
  normalizeUnit,
  getUnitKind,
  toBaseAmount,
  getUnitDefinition,
  SELECTABLE_UNITS,
  UNIT_DEFINITIONS,
} from "@/lib/unit-registry";

describe("unit-registry · normalizeUnit", () => {
  it("resolves an English plural alias to its canonical form", () => {
    expect(normalizeUnit("tablespoons")).toBe("tbsp");
  });

  it("resolves a multi-word unit regardless of spacing/case/period", () => {
    expect(normalizeUnit("fluid ounces")).toBe("fl oz");
    expect(normalizeUnit("FL. OZ")).toBe("fl oz");
    expect(normalizeUnit("fl  oz")).toBe("fl oz");
  });

  it("resolves Spanish aliases (taza/cucharada/diente)", () => {
    expect(normalizeUnit("tazas")).toBe("cup");
    expect(normalizeUnit("cucharadas")).toBe("tbsp");
    expect(normalizeUnit("dientes")).toBe("clove");
  });

  it("resolves Polish aliases (szklanka/łyżka)", () => {
    expect(normalizeUnit("szklanki")).toBe("cup");
    expect(normalizeUnit("łyżka")).toBe("tbsp");
  });

  it("passes an unknown unit through, cleaned (does not throw)", () => {
    expect(normalizeUnit("Blobs.")).toBe("blobs");
  });
});

describe("unit-registry · getUnitKind", () => {
  it("classifies weight, volume and count units", () => {
    expect(getUnitKind("kg")).toBe("weight");
    expect(getUnitKind("cup")).toBe("volume");
    expect(getUnitKind("clove")).toBe("count");
  });

  it("classifies 'stick' as count (previously fell to 'other')", () => {
    expect(getUnitKind("stick")).toBe("count");
  });

  it("returns 'other' for an unknown unit", () => {
    expect(getUnitKind("bar")).toBe("other");
  });
});

describe("unit-registry · toBaseAmount", () => {
  it("converts weight to grams", () => {
    const r = toBaseAmount(2, "oz");
    expect(r).toEqual({ amount: 2 * 28.3495, base: "g" });
  });

  it("converts volume to millilitres, including fl oz", () => {
    expect(toBaseAmount(1, "cup")).toEqual({ amount: 236.588, base: "ml" });
    expect(toBaseAmount(1, "fl oz")).toEqual({ amount: 29.574, base: "ml" });
  });

  it("returns null for count and unknown units", () => {
    expect(toBaseAmount(3, "piece")).toBeNull();
    expect(toBaseAmount(3, "bar")).toBeNull();
  });
});

describe("unit-registry · table integrity", () => {
  it("every selectable unit has a definition and a stable canonical key", () => {
    for (const u of SELECTABLE_UNITS) {
      expect(getUnitDefinition(u)?.canonical).toBe(u);
    }
  });

  it("has no duplicate canonical keys and no alias collisions", () => {
    const canon = UNIT_DEFINITIONS.map((d) => d.canonical);
    expect(new Set(canon).size).toBe(canon.length);

    const seen = new Set<string>();
    for (const d of UNIT_DEFINITIONS) {
      for (const a of d.aliases) {
        expect(seen.has(a)).toBe(false); // alias "${a}" appears twice
        seen.add(a);
        // an alias must never equal another unit's canonical key
        expect(canon.includes(a) && a !== d.canonical).toBe(false);
      }
    }
  });
});
