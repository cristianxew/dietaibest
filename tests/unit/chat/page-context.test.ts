import { describe, it, expect } from "vitest";

import { describePage, resolvePageArea } from "@/lib/chat/page-context";

const UUID = "11111111-2222-4333-8444-555555555555";

describe("describePage", () => {
  it("strips the locale prefix before matching", () => {
    expect(describePage(`/es/recipes/${UUID}`, "es").entity).toEqual({
      type: "recipe",
      id: UUID,
    });
    expect(describePage(`/pl/dashboard`, "pl").descriptor).toMatch(/dashboard/);
  });

  it("resolves the recipes list page", () => {
    const ctx = describePage("/en/recipes", "en");
    expect(ctx.descriptor).toMatch(/recipes list/);
    expect(ctx.entity).toBeUndefined();
  });

  it("resolves a recipe detail page with its entity id", () => {
    const ctx = describePage(`/en/recipes/${UUID}`, "en");
    expect(ctx.descriptor).toMatch(/detail/);
    expect(ctx.entity).toEqual({ type: "recipe", id: UUID });
  });

  it("resolves a recipe edit page with its entity id", () => {
    const ctx = describePage(`/en/recipes/${UUID}/edit`, "en");
    expect(ctx.descriptor).toMatch(/editing/);
    expect(ctx.entity).toEqual({ type: "recipe", id: UUID });
  });

  it("treats /recipes/new as a page, not an entity", () => {
    const ctx = describePage("/en/recipes/new", "en");
    expect(ctx.descriptor).toMatch(/new-recipe/);
    expect(ctx.entity).toBeUndefined();
  });

  it("does not treat a non-UUID segment as a recipe entity", () => {
    const ctx = describePage("/en/recipes/not-a-real-id", "en");
    expect(ctx.entity).toBeUndefined();
  });

  it("resolves the meal plans page", () => {
    expect(describePage("/en/meal-plans", "en").descriptor).toMatch(
      /meal plans/
    );
  });

  it("falls back for unknown routes", () => {
    const ctx = describePage("/en/some/unknown/route", "en");
    expect(ctx.descriptor).toMatch(/somewhere in the DietAI app/);
    expect(ctx.entity).toBeUndefined();
  });
});

describe("resolvePageArea", () => {
  it("strips the locale prefix before matching", () => {
    expect(resolvePageArea(`/es/recipes/${UUID}`, "es")).toEqual({
      area: "recipeDetail",
      entity: { type: "recipe", id: UUID },
    });
    expect(resolvePageArea("/pl/dashboard", "pl").area).toBe("dashboard");
  });

  it("resolves the recipes list page", () => {
    expect(resolvePageArea("/en/recipes", "en")).toEqual({
      area: "recipesList",
    });
  });

  it("resolves a recipe detail page with its entity id", () => {
    expect(resolvePageArea(`/en/recipes/${UUID}`, "en")).toEqual({
      area: "recipeDetail",
      entity: { type: "recipe", id: UUID },
    });
  });

  it("resolves a recipe edit page with its entity id", () => {
    expect(resolvePageArea(`/en/recipes/${UUID}/edit`, "en")).toEqual({
      area: "recipeEdit",
      entity: { type: "recipe", id: UUID },
    });
  });

  it("treats /recipes/new as a page, not an entity", () => {
    expect(resolvePageArea("/en/recipes/new", "en")).toEqual({
      area: "recipeNew",
    });
  });

  it("does not treat a non-UUID segment as a recipe entity", () => {
    expect(resolvePageArea("/en/recipes/not-a-real-id", "en")).toEqual({
      area: "other",
    });
  });

  it("resolves the meal plans, nutrition and shopping sections", () => {
    expect(resolvePageArea("/en/meal-plans", "en").area).toBe("mealPlans");
    expect(resolvePageArea("/en/nutrition/compare", "en").area).toBe(
      "nutrition"
    );
    expect(resolvePageArea("/en/shopping", "en").area).toBe("shopping");
  });

  it("falls back to 'other' for unknown routes", () => {
    expect(resolvePageArea("/en/some/unknown/route", "en")).toEqual({
      area: "other",
    });
    expect(resolvePageArea("/en/settings", "en")).toEqual({ area: "other" });
  });
});
