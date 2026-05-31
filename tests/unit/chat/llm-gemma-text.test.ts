import { describe, it, expect } from "vitest";
import type { GoogleGenAI } from "@google/genai";

import { GemmaProvider, GemmaExtractionError } from "@/lib/chat/llm-gemma";

/** Build a provider whose Gemini client returns a canned JSON string. */
function providerReturning(json: unknown, capture?: (text: string) => void) {
  const clientOverride = {
    models: {
      async generateContent(params: {
        contents: Array<{ parts: Array<{ text?: string }> }>;
      }) {
        capture?.(params.contents[0]?.parts[0]?.text ?? "");
        return { text: JSON.stringify(json) };
      },
    },
  } as unknown as Pick<GoogleGenAI, "models">;
  return new GemmaProvider({ clientOverride });
}

describe("GemmaProvider.extractRecipeFromText", () => {
  it("extracts a structured recipe from web-page markdown", async () => {
    const provider = providerReturning({
      title: "Chocolate Chip Cookies",
      ingredients: [{ name: "flour", amount: 2, unit: "cup" }],
      instructions: ["Mix", "Bake"],
    });

    const recipe = await provider.extractRecipeFromText({
      content: "# Chocolate Chip Cookies\n\nIngredients: 2 cups flour...",
      locale: "en",
      sourceUrl: "https://recipes.example.com/cookies",
    });

    expect(recipe.title).toBe("Chocolate Chip Cookies");
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.sourceUrl).toBe("https://recipes.example.com/cookies");
  });

  it("throws no-ingredients when the page has no recipe", async () => {
    const provider = providerReturning({
      title: "",
      ingredients: [],
      instructions: [],
    });

    await expect(
      provider.extractRecipeFromText({ content: "Category index page", locale: "en" })
    ).rejects.toMatchObject({ reason: "no-ingredients" });
    await expect(
      provider.extractRecipeFromText({ content: "Category index page", locale: "en" })
    ).rejects.toBeInstanceOf(GemmaExtractionError);
  });

  it("truncates oversized markdown to the character cap before sending", async () => {
    let sentText = "";
    const provider = providerReturning(
      {
        title: "Soup",
        ingredients: [{ name: "water", amount: 1, unit: "l" }],
        instructions: ["Boil"],
      },
      (text) => {
        sentText = text;
      }
    );

    const huge = "x".repeat(50_000);
    await provider.extractRecipeFromText({ content: huge, locale: "en" });

    // Prompt prefix + at most 24k content chars — far below the 50k input.
    expect(sentText.length).toBeLessThan(24_500);
  });
});
