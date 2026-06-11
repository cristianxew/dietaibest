import { describe, it, expect } from "vitest";

import {
  capabilities,
  followUpMap,
  selectCapabilitiesForPath,
  computeFollowUps,
  getCapability,
} from "@/lib/chat/capabilities";
import type { PageArea } from "@/lib/chat/page-context";
import { allTools } from "@/lib/chat/tools/index";
import en from "../../../messages/en.json";

const UUID = "11111111-2222-4333-8444-555555555555";

const VALID_AREAS: ReadonlyArray<PageArea | "global"> = [
  "dashboard",
  "recipesList",
  "recipeDetail",
  "recipeEdit",
  "recipeNew",
  "mealPlans",
  "nutrition",
  "shopping",
  "other",
  "global",
];

// importRecipeFromImage is flag-gated out of the registry in most test runs,
// but the catalog deliberately keeps advertising photo import (same status quo
// as the old EmptyChat) — accept it as a known tool name either way.
const knownToolNames = new Set([
  ...allTools.map((t) => t.name),
  "importRecipeFromImage",
]);

const enCapabilities = (
  en as unknown as {
    chat: {
      capabilities: Record<
        string,
        { label?: string; prompt?: string; entityPrompt?: string }
      >;
    };
  }
).chat.capabilities;

describe("capability catalog", () => {
  it("has unique ids", () => {
    const ids = capabilities.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses valid page areas in contexts", () => {
    for (const cap of capabilities) {
      expect(cap.contexts.length).toBeGreaterThan(0);
      for (const ctx of cap.contexts) {
        expect(VALID_AREAS).toContain(ctx);
      }
    }
  });

  it("references only registry tools via toolName", () => {
    for (const cap of capabilities) {
      if (cap.toolName) {
        expect(knownToolNames.has(cap.toolName), cap.toolName).toBe(true);
      }
    }
  });

  it("followUpMap keys are registry tools and values are capability ids", () => {
    const ids = new Set(capabilities.map((c) => c.id));
    for (const [toolName, followUps] of Object.entries(followUpMap)) {
      expect(knownToolNames.has(toolName), toolName).toBe(true);
      for (const id of followUps ?? []) {
        expect(ids.has(id), id).toBe(true);
      }
    }
  });

  it("has en.json label + prompt for every capability, entityPrompt iff entityAware", () => {
    for (const cap of capabilities) {
      const copy = enCapabilities[cap.id];
      expect(copy, cap.id).toBeDefined();
      expect(copy.label, `${cap.id}.label`).toBeTruthy();
      expect(copy.prompt, `${cap.id}.prompt`).toBeTruthy();
      if (cap.entityAware) {
        expect(copy.entityPrompt, `${cap.id}.entityPrompt`).toBeTruthy();
      } else {
        expect(copy.entityPrompt, `${cap.id}.entityPrompt`).toBeUndefined();
      }
    }
  });

  it("getCapability returns the matching entry", () => {
    expect(getCapability("analyzeNutrition").id).toBe("analyzeNutrition");
  });
});

describe("selectCapabilitiesForPath", () => {
  it("ranks recipe actions first on a recipe detail page", () => {
    const ids = selectCapabilitiesForPath(`/en/recipes/${UUID}`, "en").map(
      (c) => c.id
    );
    expect(ids.slice(0, 3)).toEqual([
      "analyzeNutrition",
      "generateRecipeImage",
      "addRecipeToPlan",
    ]);
  });

  it("ranks plan capabilities first on the meal plans page", () => {
    const ids = selectCapabilitiesForPath("/en/meal-plans", "en").map(
      (c) => c.id
    );
    expect(ids[0]).toBe("generateMealPlan");
    expect(ids).toContain("adjustMealPlan");
    expect(ids).toContain("addRecipeToPlan");
  });

  it("returns only global capabilities for unknown routes", () => {
    const caps = selectCapabilitiesForPath("/en/some/unknown", "en");
    expect(caps[0]?.id).toBe("createRecipeFromDescription");
    for (const cap of caps) {
      expect(cap.contexts).toContain("global");
    }
  });

  it("respects max and never returns duplicates", () => {
    expect(selectCapabilitiesForPath(`/en/recipes/${UUID}`, "en", 2)).toHaveLength(
      2
    );
    const ids = selectCapabilitiesForPath(`/en/recipes/${UUID}`, "en").map(
      (c) => c.id
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeLessThanOrEqual(5);
  });
});

describe("computeFollowUps", () => {
  it("maps createRecipe to its follow-up capabilities in order", () => {
    expect(computeFollowUps(["createRecipe"]).map((c) => c.id)).toEqual([
      "analyzeNutrition",
      "generateRecipeImage",
      "addRecipeToPlan",
    ]);
  });

  it("puts the last-completed tool's follow-ups first, dedupes and caps at 3", () => {
    const ids = computeFollowUps(["createRecipe", "getNutrition"]).map(
      (c) => c.id
    );
    expect(ids).toEqual([
      "addRecipeToPlan",
      "generateMealPlan",
      "analyzeNutrition",
    ]);
  });

  it("returns nothing for unmapped tools or empty turns", () => {
    expect(computeFollowUps(["searchRecipes"])).toEqual([]);
    expect(computeFollowUps([])).toEqual([]);
  });

  it("respects a custom max", () => {
    expect(computeFollowUps(["createRecipe"], 2)).toHaveLength(2);
  });
});
