import { describe, expect, it } from "vitest";
import { mealPlansReturnPath, recipeHref, resolveRecipeBackLink, withReturnPath } from "@/lib/recipe-back-link";

const PLAN_ID = "e55a39f8-acb7-45a3-b4f6-4dd976526ec6";

describe("recipeHref", () => {
  it("links to the plain recipe page without a return path", () => {
    expect(recipeHref("en", "r1")).toBe("/en/recipes/r1");
    expect(recipeHref("en", "r1", null)).toBe("/en/recipes/r1");
  });

  it("carries the return path as an encoded `from` param", () => {
    const href = recipeHref("es", "r1", `/meal-plans?selected=${PLAN_ID}`);
    expect(href).toBe(`/es/recipes/r1?from=${encodeURIComponent(`/meal-plans?selected=${PLAN_ID}`)}`);
  });
});

describe("withReturnPath", () => {
  it("appends the return path to a recipe href built elsewhere (chat tool links)", () => {
    expect(withReturnPath("/recipes/r1", "/meal-plans?selected=p1")).toBe(
      `/recipes/r1?from=${encodeURIComponent("/meal-plans?selected=p1")}`
    );
    expect(withReturnPath("/recipes/r1?x=1", "/dashboard")).toBe(
      `/recipes/r1?x=1&from=${encodeURIComponent("/dashboard")}`
    );
  });

  it("leaves the href alone when it already points at the current page", () => {
    expect(withReturnPath("/recipes/r1", "/recipes/r1")).toBe("/recipes/r1");
  });
});

describe("mealPlansReturnPath", () => {
  it("returns to the open plan, or to the planner when none is selected", () => {
    expect(mealPlansReturnPath(PLAN_ID)).toBe(`/meal-plans?selected=${PLAN_ID}`);
    expect(mealPlansReturnPath(null)).toBe("/meal-plans");
    expect(mealPlansReturnPath(undefined)).toBe("/meal-plans");
  });
});

describe("resolveRecipeBackLink", () => {
  it("defaults to the recipe library", () => {
    expect(resolveRecipeBackLink("en", {})).toEqual({ href: "/en/recipes", target: "recipes" });
  });

  it("returns to the meal plan the recipe was opened from", () => {
    expect(resolveRecipeBackLink("pl", { from: `/meal-plans?selected=${PLAN_ID}` })).toEqual({
      href: `/pl/meal-plans?selected=${PLAN_ID}`,
      target: "meal-plans",
    });
  });

  it("names the dashboard and the library", () => {
    expect(resolveRecipeBackLink("en", { from: "/dashboard" })).toEqual({
      href: "/en/dashboard",
      target: "dashboard",
    });
    expect(resolveRecipeBackLink("en", { from: "/recipes?page=2" })).toEqual({
      href: "/en/recipes?page=2",
      target: "recipes",
    });
  });

  it("returns to any other in-app page with a generic label", () => {
    expect(resolveRecipeBackLink("en", { from: "/nutrition/my-week" })).toEqual({
      href: "/en/nutrition/my-week",
      target: "previous",
    });
  });

  it("accepts a path that already carries the current locale (chat on a non-default locale)", () => {
    expect(resolveRecipeBackLink("es", { from: "/es/dashboard" })).toEqual({
      href: "/es/dashboard",
      target: "dashboard",
    });
    expect(resolveRecipeBackLink("es", { from: "/es" })).toEqual({ href: "/es", target: "previous" });
  });

  it("drops the hash", () => {
    expect(resolveRecipeBackLink("en", { from: "/dashboard#recent" }).href).toBe("/en/dashboard");
  });

  it("never returns to a recipe form", () => {
    expect(resolveRecipeBackLink("en", { from: "/recipes/new" })).toEqual({
      href: "/en/recipes",
      target: "recipes",
    });
    expect(resolveRecipeBackLink("en", { from: "/recipes/abc/edit" })).toEqual({
      href: "/en/recipes",
      target: "recipes",
    });
  });

  it("rejects anything that is not a same-site path", () => {
    const fallback = { href: "/en/recipes", target: "recipes" };
    for (const from of [
      "https://evil.example/x",
      "//evil.example/x",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "dashboard",
      "",
      `/${"a".repeat(400)}`,
    ]) {
      expect(resolveRecipeBackLink("en", { from }), from).toEqual(fallback);
    }
  });

  it("ignores repeated params", () => {
    expect(resolveRecipeBackLink("en", { from: ["/dashboard", "/meal-plans"] })).toEqual({
      href: "/en/recipes",
      target: "recipes",
    });
  });
});
