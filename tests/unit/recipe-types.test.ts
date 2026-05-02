import { describe, it, expectTypeOf } from "vitest";
import type {
  ImportedRecipe,
  Ingredient,
} from "@/types/recipe";

describe("ImportedRecipe canonical type", () => {
  it("requires the core fields produced by every extraction pipeline", () => {
    expectTypeOf<ImportedRecipe>().toHaveProperty("title").toEqualTypeOf<string>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("ingredients")
      .toEqualTypeOf<Ingredient[]>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("instructions")
      .toEqualTypeOf<string[]>();
  });

  it("exposes every optional field listed in the canonical contract", () => {
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("description")
      .toEqualTypeOf<string | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("prepTime")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("cookTime")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("servings")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("difficulty")
      .toEqualTypeOf<string | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("imageUrl")
      .toEqualTypeOf<string | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("tags")
      .toEqualTypeOf<string[] | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("calories")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("protein")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("carbs")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("fat")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("fiber")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("sugar")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("sodium")
      .toEqualTypeOf<number | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("cuisine")
      .toEqualTypeOf<string | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("sourceUrl")
      .toEqualTypeOf<string | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("extractedAt")
      .toEqualTypeOf<string | undefined>();
    expectTypeOf<ImportedRecipe>()
      .toHaveProperty("confidence")
      .toEqualTypeOf<number | undefined>();
  });


  it("accepts a minimal payload with only required fields", () => {
    const minimal: ImportedRecipe = {
      title: "Pasta carbonara",
      ingredients: [{ name: "pasta", amount: 200, unit: "g" }],
      instructions: ["Boil water", "Cook pasta"],
    };
    expectTypeOf(minimal).toMatchTypeOf<ImportedRecipe>();
  });

  it("accepts a full payload including pipeline metadata", () => {
    const full: ImportedRecipe = {
      title: "Pasta carbonara",
      description: "Classic Roman pasta",
      prepTime: 10,
      cookTime: 15,
      servings: 4,
      difficulty: "medium",
      ingredients: [{ name: "pasta", amount: 200, unit: "g" }],
      instructions: ["Boil water", "Cook pasta"],
      imageUrl: "https://example.com/img.jpg",
      tags: ["italian", "pasta"],
      calories: 520,
      protein: 22,
      carbs: 60,
      fat: 18,
      fiber: 3,
      sugar: 2,
      sodium: 600,
      cuisine: "italian",
      sourceUrl: "https://example.com/recipe",
      extractedAt: "2026-05-02T20:00:00.000Z",
      confidence: 0.92,
    };
    expectTypeOf(full).toMatchTypeOf<ImportedRecipe>();
  });
});
