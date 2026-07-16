import { describe, it, expect } from "vitest";
import {
  ENCYCLOPEDIA,
  findEncyclopediaEntry,
} from "@/lib/nutrients/encyclopedia";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";

describe("ENCYCLOPEDIA data integrity", () => {
  it("has unique slugs and nutrients", () => {
    const slugs = ENCYCLOPEDIA.map((e) => e.slug);
    const nutrients = ENCYCLOPEDIA.map((e) => e.nutrient);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(nutrients).size).toBe(nutrients.length);
  });

  it("references only registry nutrients and has at least 2 sources each", () => {
    for (const entry of ENCYCLOPEDIA) {
      expect(NUTRIENT_REGISTRY[entry.nutrient], entry.slug).toBeDefined();
      expect(entry.topSourceFdcIds.length, entry.slug).toBeGreaterThanOrEqual(2);
      expect(new Set(entry.topSourceFdcIds).size).toBe(
        entry.topSourceFdcIds.length
      );
    }
  });

  it("covers 18 nutrients with valid accents", () => {
    expect(ENCYCLOPEDIA).toHaveLength(18);
    for (const entry of ENCYCLOPEDIA) {
      expect(["brand", "sage", "gold"]).toContain(entry.accent);
    }
  });

  it("finds entries by slug and rejects unknown slugs", () => {
    expect(findEncyclopediaEntry("potassium")?.nutrient).toBe("potassium");
    expect(findEncyclopediaEntry("vitamin-c")?.nutrient).toBe("vitaminC");
    expect(findEncyclopediaEntry("unobtainium")).toBeNull();
  });
});
