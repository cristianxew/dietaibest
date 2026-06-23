import { describe, it, expect } from "vitest";
import { generateRecipeFingerprint } from "@/lib/recipe-fingerprint";

describe("generateRecipeFingerprint", () => {
  it("is deterministic for the same content", () => {
    const a = generateRecipeFingerprint({
      title: "Miso soup",
      ingr: ["100 g tofu", "1 tbsp miso paste"],
    });
    const b = generateRecipeFingerprint({
      title: "Miso soup",
      ingr: ["100 g tofu", "1 tbsp miso paste"],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
  });

  it("is insensitive to ingredient order, case, and surrounding whitespace", () => {
    const a = generateRecipeFingerprint({
      title: "Miso Soup",
      ingr: ["100 g tofu", "1 tbsp miso paste"],
    });
    const b = generateRecipeFingerprint({
      title: "  miso soup ",
      ingr: ["  1 TBSP MISO PASTE", "100 G TOFU "],
    });
    expect(a).toBe(b);
  });

  it("changes when the content changes", () => {
    const a = generateRecipeFingerprint({ title: "Soup", ingr: ["tofu"] });
    const b = generateRecipeFingerprint({ title: "Soup", ingr: ["tempeh"] });
    expect(a).not.toBe(b);
  });
});
