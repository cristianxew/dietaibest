import { describe, expect, it } from "vitest";
import { transformShoppingItem } from "@/lib/shopping-item-transformer";

describe("shopping-item-transformer · unit registry integration", () => {
  it("treats weight units as grams", () => {
    const r = transformShoppingItem({ name: "chicken breast", amount: 200, unit: "g" });
    expect(r.displayQuantity).toBe("200g");
  });

  it("keeps liquids in ml", () => {
    const r = transformShoppingItem({ name: "milk", amount: 250, unit: "ml" });
    expect(r.displayQuantity).toBe("250ml");
  });

  it("treats count units as a plain count", () => {
    const r = transformShoppingItem({ name: "egg", amount: 3, unit: "piece" });
    expect(r.displayQuantity).toBe("3");
  });

  // Bug fix: the transformer's private normalizeUnit only did lowercase+trim, so
  // alias spellings fell through to the "unknown → count" branch. Now they
  // resolve through the registry like everywhere else.
  it("resolves an English plural alias ('tablespoons') as volume, not count", () => {
    const r = transformShoppingItem({ name: "olive oil", amount: 2, unit: "tablespoons" });
    expect(r.displayQuantity).toMatch(/ml$/); // oil is liquid → ml, NOT "2"
    expect(r.displayQuantity).not.toBe("2");
  });

  it("resolves a Spanish alias ('cucharadas') as volume, not count", () => {
    const r = transformShoppingItem({ name: "aceite", amount: 3, unit: "cucharadas" });
    expect(r.displayQuantity).not.toBe("3"); // resolved, not treated as count
  });

  it("converts a solid measured by volume into grams", () => {
    const r = transformShoppingItem({ name: "flour", amount: 2, unit: "cups" });
    expect(r.displayQuantity).toMatch(/g$/); // solid → grams, not count
  });
});
