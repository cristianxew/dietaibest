import { describe, expect, it } from "vitest";
import { applySynonyms } from "@/lib/ingredients";

describe("applySynonyms · word-boundary matching (P0 regression)", () => {
  // The bug: includes()-based matching collapsed any name CONTAINING a short
  // synonym substring. "sal" -> "salt" meant salmon/salsa/salad all became
  // "salt", silently zeroing a very common protein's nutrition.
  it("does NOT collapse 'salmon' to 'salt'", () => {
    expect(applySynonyms("salmon")).toBe("salmon");
  });

  it("does NOT collapse 'salsa' to 'salt' (maps to its real synonym 'sauce')", () => {
    expect(applySynonyms("salsa")).not.toBe("salt");
  });

  it("does NOT collapse 'salad' to 'salt'", () => {
    expect(applySynonyms("salad")).toBe("salad");
  });

  it("still maps the standalone word 'sal' to 'salt'", () => {
    expect(applySynonyms("sal")).toBe("salt");
  });
});

describe("applySynonyms · intended substitutions still hold", () => {
  it("maps a Spanish single word (cebolla -> onion)", () => {
    expect(applySynonyms("cebolla")).toBe("onion");
  });

  it("maps an accented-final word (café -> coffee, té -> tea)", () => {
    expect(applySynonyms("café")).toBe("coffee");
    expect(applySynonyms("té")).toBe("tea");
  });

  it("maps a multi-word phrase (aceite de oliva -> olive oil)", () => {
    expect(applySynonyms("aceite de oliva")).toBe("olive oil");
  });

  it("maps a synonym embedded as a whole word in a phrase (garbanzo beans -> chickpeas)", () => {
    expect(applySynonyms("garbanzo beans")).toBe("chickpeas");
  });

  it("leaves an unknown name untouched", () => {
    expect(applySynonyms("dragon fruit")).toBe("dragon fruit");
  });
});
