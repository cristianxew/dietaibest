import { describe, it, expect } from "vitest";
import { SMART_SWAPS, SWAP_CATEGORIES } from "@/lib/nutrients/swaps-data";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";

describe("SMART_SWAPS data integrity", () => {
  it("has unique ids and from ≠ to in every pair", () => {
    const ids = SMART_SWAPS.map((swap) => swap.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const swap of SMART_SWAPS) {
      expect(swap.fromFdcId, swap.id).not.toBe(swap.toFdcId);
    }
  });

  it("uses registry nutrients and 1-3 headline nutrients per swap", () => {
    for (const swap of SMART_SWAPS) {
      expect(swap.headlineNutrients.length, swap.id).toBeGreaterThanOrEqual(1);
      expect(swap.headlineNutrients.length, swap.id).toBeLessThanOrEqual(3);
      for (const nutrient of swap.headlineNutrients) {
        expect(NUTRIENT_REGISTRY[nutrient], `${swap.id}:${nutrient}`).toBeDefined();
      }
    }
  });

  it("uses only declared categories", () => {
    for (const swap of SMART_SWAPS) {
      expect(SWAP_CATEGORIES, swap.id).toContain(swap.category);
    }
  });

  it("offers at least 6 swaps", () => {
    expect(SMART_SWAPS.length).toBeGreaterThanOrEqual(6);
  });
});
