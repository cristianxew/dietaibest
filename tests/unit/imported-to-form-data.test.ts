import { describe, it, expect } from "vitest";
import { importedToFormData } from "@/lib/recipe-utils";
import type { ImportedRecipe, RecipeFormData } from "@/types/recipe";

describe("importedToFormData", () => {
  // ---------------------------------------------------------------------------
  // Minimal payload — only required ImportedRecipe fields
  // ---------------------------------------------------------------------------
  it("maps a minimal ImportedRecipe to a valid RecipeFormData", () => {
    const minimal: ImportedRecipe = {
      title: "Simple toast",
      ingredients: [{ name: "bread", amount: 2, unit: "slices" }],
      instructions: ["Toast the bread"],
    };

    const result = importedToFormData(minimal);

    expect(result.title).toBe("Simple toast");
    expect(result.ingredients).toEqual([
      { name: "bread", amount: 2, unit: "slices" },
    ]);
    expect(result.instructions).toEqual(["Toast the bread"]);
  });

  // ---------------------------------------------------------------------------
  // Defaults for missing optional fields
  // ---------------------------------------------------------------------------
  it("defaults servings to 1 when not provided", () => {
    const noServings: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(noServings).servings).toBe(1);
  });

  it("defaults description to empty string when not provided", () => {
    const noDesc: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(noDesc).description).toBe("");
  });

  it("defaults imageUrl to empty string when not provided", () => {
    const noImage: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(noImage).imageUrl).toBe("");
  });

  it("defaults sourceUrl to empty string when not provided", () => {
    const noSource: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(noSource).sourceUrl).toBe("");
  });

  it("always sets categoryIds to empty array", () => {
    const input: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(input).categoryIds).toEqual([]);
  });

  it("always sets isPublic to false", () => {
    const input: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(input).isPublic).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Cuisine → tags mapping
  // ---------------------------------------------------------------------------
  it("merges cuisine into tags array", () => {
    const withCuisine: ImportedRecipe = {
      title: "Paella",
      ingredients: [{ name: "rice", amount: 2, unit: "cups" }],
      instructions: ["Cook"],
      tags: ["seafood"],
      cuisine: "Spanish",
    };

    const result = importedToFormData(withCuisine);

    expect(result.tags).toContain("seafood");
    expect(result.tags).toContain("Spanish");
    expect(result.tags).toEqual(["seafood", "Spanish"]);
  });

  it("produces correct tags when only cuisine is present (no tags)", () => {
    const cuisineOnly: ImportedRecipe = {
      title: "Sushi",
      ingredients: [{ name: "rice", amount: 1, unit: "cup" }],
      instructions: ["Roll"],
      cuisine: "Japanese",
    };

    expect(importedToFormData(cuisineOnly).tags).toEqual(["Japanese"]);
  });

  it("produces empty tags when neither tags nor cuisine are present", () => {
    const noTags: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(noTags).tags).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Difficulty normalization
  // ---------------------------------------------------------------------------
  it("lowercases difficulty to match RecipeFormData enum", () => {
    const withDifficulty: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
      difficulty: "Medium",
    };

    expect(importedToFormData(withDifficulty).difficulty).toBe("medium");
  });

  it("passes through already-lowercase difficulty", () => {
    const easy: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
      difficulty: "easy",
    };

    expect(importedToFormData(easy).difficulty).toBe("easy");
  });

  it("leaves difficulty undefined when not provided", () => {
    const noDifficulty: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
    };

    expect(importedToFormData(noDifficulty).difficulty).toBeUndefined();
  });

  // ---------------------------------------------------------------------------
  // Full payload — all fields mapped
  // ---------------------------------------------------------------------------
  it("maps all fields from a fully-populated ImportedRecipe", () => {
    const full: ImportedRecipe = {
      title: "Pasta carbonara",
      description: "Classic Roman pasta",
      prepTime: 10,
      cookTime: 15,
      servings: 4,
      difficulty: "Medium",
      ingredients: [
        { name: "spaghetti", amount: 400, unit: "g" },
        { name: "guanciale", amount: 150, unit: "g" },
      ],
      instructions: ["Boil water", "Cook pasta", "Mix sauce"],
      imageUrl: "https://example.com/carbonara.jpg",
      tags: ["italian", "pasta"],
      calories: 520,
      protein: 22,
      carbs: 60,
      fat: 18,
      fiber: 3,
      sugar: 2,
      sodium: 600,
      cuisine: "Italian",
      sourceUrl: "https://example.com/recipe",
      extractedAt: "2026-05-02T20:00:00.000Z",
      confidence: 0.92,
    };

    const result = importedToFormData(full);

    // Core
    expect(result.title).toBe("Pasta carbonara");
    expect(result.description).toBe("Classic Roman pasta");
    expect(result.ingredients).toHaveLength(2);
    expect(result.instructions).toEqual(["Boil water", "Cook pasta", "Mix sauce"]);

    // Timing
    expect(result.prepTime).toBe(10);
    expect(result.cookTime).toBe(15);
    expect(result.servings).toBe(4);

    // Difficulty normalized
    expect(result.difficulty).toBe("medium");

    // Image & source
    expect(result.imageUrl).toBe("https://example.com/carbonara.jpg");
    expect(result.sourceUrl).toBe("https://example.com/recipe");

    // Tags = original tags + cuisine
    expect(result.tags).toEqual(["italian", "pasta", "Italian"]);

    // Nutrition
    expect(result.calories).toBe(520);
    expect(result.protein).toBe(22);
    expect(result.carbs).toBe(60);
    expect(result.fat).toBe(18);
    expect(result.fiber).toBe(3);
    expect(result.sugar).toBe(2);
    expect(result.sodium).toBe(600);

    // Structural
    expect(result.categoryIds).toEqual([]);
    expect(result.isPublic).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Pipeline metadata is NOT carried through
  // ---------------------------------------------------------------------------
  it("does not carry extractedAt or confidence into form data", () => {
    const withMeta: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
      extractedAt: "2026-05-02T20:00:00.000Z",
      confidence: 0.95,
    };

    const result = importedToFormData(withMeta);
    const resultKeys = Object.keys(result);

    expect(resultKeys).not.toContain("extractedAt");
    expect(resultKeys).not.toContain("confidence");
  });

  // ---------------------------------------------------------------------------
  // Servings passthrough
  // ---------------------------------------------------------------------------
  it("passes through servings when explicitly set", () => {
    const withServings: ImportedRecipe = {
      title: "T",
      ingredients: [{ name: "a", amount: 1, unit: "u" }],
      instructions: ["step"],
      servings: 8,
    };

    expect(importedToFormData(withServings).servings).toBe(8);
  });
});
