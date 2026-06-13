import { describe, it, expect } from "vitest";

import { createRecipe } from "@/lib/chat/tools/createRecipe";
import { generateRecipeImage } from "@/lib/chat/tools/generateRecipeImage";
import { importRecipeFromImage } from "@/lib/chat/tools/importRecipeFromImage";

/**
 * Category-2 single-tool rules moved out of the monolithic system prompt and
 * onto their tools. These pins guarantee the behavioral rules survived the
 * relocation — they are NOT lost, just relocated to the tool that owns them.
 */
describe("tool guidance — Category-2 rules co-located with their tool", () => {
  it("createRecipe keeps the coarse-grained rule", () => {
    expect(createRecipe.guidance).toBeTruthy();
    expect(createRecipe.guidance!.toLowerCase()).toContain("coarse-grained");
  });

  it("generateRecipeImage keeps the askFirst image rules", () => {
    expect(generateRecipeImage.guidance).toBeTruthy();
    expect(generateRecipeImage.guidance).toContain("askFirst");
  });

  it("generateRecipeImage tells the model explicit requests use askFirst: false", () => {
    // Without this rule the model passes askFirst: true on explicit
    // regeneration requests, the existing-image backstop skips silently, and
    // the user is told an image was generated when nothing happened.
    expect(generateRecipeImage.guidance).toMatch(
      /explicit[^\n]*askFirst: false/i
    );
  });

  it("importRecipeFromImage keeps the attachment marker protocol", () => {
    expect(importRecipeFromImage.guidance).toBeTruthy();
    expect(importRecipeFromImage.guidance).toContain("[attachment kind=image eventId=");
  });
});
