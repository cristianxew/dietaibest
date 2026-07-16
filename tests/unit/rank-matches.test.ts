import { describe, expect, it } from "vitest";
import { rankMatches, matchPlausible } from "@/lib/fdc-match";
import type { FdcSearchFood } from "@/lib/fdc";

function f(fdcId: number, description: string, dataType: string): FdcSearchFood {
  return { fdcId, description, dataType };
}

describe("rankMatches", () => {
  it("ranks by USDA data-type priority first (Foundation > Branded)", () => {
    const ranked = rankMatches(
      [f(2, "Onion, raw", "Branded"), f(1, "Onion, raw", "Foundation")],
      "onion"
    );
    expect(ranked[0].fdcId).toBe(1);
  });

  it("within the same data type, prefers a closer name over a narrowed variant", () => {
    // Both Foundation; "egg white" carries a qualifier the query didn't ask for.
    const ranked = rankMatches(
      [
        f(747997, "Eggs, Grade A, Large, egg white", "Foundation"),
        f(748967, "Egg, whole, raw, fresh", "Foundation"),
      ],
      "egg"
    );
    expect(ranked[0].fdcId).toBe(748967); // whole egg, not egg white
  });

  it("does NOT penalize a qualifier the query explicitly contains", () => {
    const ranked = rankMatches(
      [
        f(1, "Egg, whole, raw", "Foundation"),
        f(2, "Egg white, raw", "Foundation"),
      ],
      "egg white"
    );
    expect(ranked[0].fdcId).toBe(2); // query asked for white → not penalized
  });

  it("demotes an FNDDS composite dish below a basic ingredient ACROSS data types", () => {
    // After the whole-food tier merge, FNDDS dishes share the candidate pool with
    // SR Legacy basics. FNDDS outranks SR Legacy by data-type priority, so without
    // a cross-type dish demotion "Rice pilaf" would crowd out raw rice. It must not.
    const ranked = rankMatches(
      [
        f(2, "Rice pilaf", "Survey (FNDDS)"),
        f(1, "Rice, white, long-grain, regular, raw", "SR Legacy"),
      ],
      "rice"
    );
    expect(ranked[0].fdcId).toBe(1); // basic raw rice, not the pilaf dish
  });

  it("does NOT demote a dish word the query explicitly contains (beef stew meat)", () => {
    // The exact-match FNDDS entry must win; the canned-entree dish is demoted.
    const ranked = rankMatches(
      [
        f(2, "Beef stew, canned entree", "SR Legacy"),
        f(1, "Beef, stew meat", "Survey (FNDDS)"),
      ],
      "beef stew meat"
    );
    expect(ranked[0].fdcId).toBe(1);
  });

  it("returns an empty array for no candidates", () => {
    expect(rankMatches([], "anything")).toEqual([]);
  });
});

describe("matchPlausible", () => {
  it("rejects a match sharing no content token with the query (the chicken→Clif-bar class)", () => {
    // The catastrophic real-world case: an untranslated Polish name whose only
    // USDA candidates are unrelated branded products.
    expect(matchPlausible("Clif Z bar", "mięso z piersi kurczaka")).toBe(false);
  });

  it("ignores short stopword tokens so an incidental 1-letter hit is not overlap", () => {
    // "z" (Polish stopword) appears in "Clif Z bar" but must not count.
    expect(matchPlausible("Clif Z bar", "kurczak z")).toBe(false);
  });

  it("keeps a match that shares a content token (substring-tolerant for plurals)", () => {
    expect(matchPlausible("Tomatoes, red, ripe, raw", "tomato")).toBe(true);
    expect(matchPlausible("Fish, salmon, Atlantic, wild, raw", "salmon")).toBe(
      true
    );
    expect(
      matchPlausible("Chicken, breast, boneless, raw", "chicken breast")
    ).toBe(true);
  });

  it("does not over-reject when the query has no content tokens (≥3 chars)", () => {
    expect(matchPlausible("anything at all", "ax")).toBe(true);
  });
});
