import { describe, it, expect } from "vitest";
import { parseItemRef, serializeItemRef } from "@/lib/nutrients/compare-url";

describe("parseItemRef", () => {
  it("parses fdc refs", () => {
    expect(parseItemRef("fdc:171705")).toEqual({ type: "fdc", id: 171705 });
  });

  it("parses recipe refs (uuid)", () => {
    const uuid = "0b6cdd35-32b4-4f02-9173-5d8b9f2cba11";
    expect(parseItemRef(`recipe:${uuid}`)).toEqual({
      type: "recipe",
      id: uuid,
    });
  });

  it("rejects malformed refs", () => {
    expect(parseItemRef("fdc:abc")).toBeNull();
    expect(parseItemRef("fdc:-5")).toBeNull();
    expect(parseItemRef("recipe:not-a-uuid")).toBeNull();
    expect(parseItemRef("banana")).toBeNull();
    expect(parseItemRef("")).toBeNull();
    expect(parseItemRef(undefined)).toBeNull();
  });
});

describe("serializeItemRef", () => {
  it("round-trips both ref types", () => {
    const fdc = { type: "fdc" as const, id: 171705 };
    const recipe = {
      type: "recipe" as const,
      id: "0b6cdd35-32b4-4f02-9173-5d8b9f2cba11",
    };
    expect(parseItemRef(serializeItemRef(fdc))).toEqual(fdc);
    expect(parseItemRef(serializeItemRef(recipe))).toEqual(recipe);
    expect(serializeItemRef(fdc)).toBe("fdc:171705");
  });
});
