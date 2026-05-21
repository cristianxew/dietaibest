import { describe, it, expect } from "vitest";

import { allTools, filterToolsForContext, findTool } from "@/lib/chat/tools/index";
import type { AgentContext } from "@/lib/chat/context";
import type { Entitlements } from "@/lib/entitlements";

const FREE: Entitlements = {
  isPro: false,
  limits: {
    savedRecipes: 15,
    recipesCreatedPerMonth: 3,
    importsPerMonth: 0,
    mealPlanTemplates: 1,
    mealPlanDurationDays: 3,
    edamamAnalysesPerMonth: 5,
  },
  features: {
    aiMealPlan: false,
    shoppingAutomation: false,
    recipeImport: false,
    aiChat: false,
  },
};

const PRO: Entitlements = {
  isPro: true,
  limits: {
    savedRecipes: Number.POSITIVE_INFINITY,
    recipesCreatedPerMonth: Number.POSITIVE_INFINITY,
    importsPerMonth: Number.POSITIVE_INFINITY,
    mealPlanTemplates: Number.POSITIVE_INFINITY,
    mealPlanDurationDays: Number.POSITIVE_INFINITY,
    edamamAnalysesPerMonth: Number.POSITIVE_INFINITY,
  },
  features: {
    aiMealPlan: true,
    shoppingAutomation: true,
    recipeImport: true,
    aiChat: true,
  },
};

function ctx(entitlements: Entitlements): AgentContext {
  return {
    userId: "u1",
    locale: "en",
    conversationId: "c1",
    entitlements,
  };
}

describe("Tool registry", () => {
  it("exposes all expected tools", () => {
    const names = allTools.map((t) => t.name).sort();
    const base = [
      "addMealToDay",
      "createRecipe",
      "deleteRecipe",
      "editRecipe",
      "generateMealPlan",
      "generateRecipeImage",
      "getMealPlan",
      "getNutrition",
      "getRecipe",
      "importRecipeFromUrl",
      "moveMeal",
      "removeMealFromDay",
      "searchMealPlans",
      "searchRecipes",
      "updateMealServings",
    ];
    const expected = [
      ...base,
      ...(process.env.FEATURE_MULTIMODAL_IMPORT === "true"
        ? ["importRecipeFromImage"]
        : []),
    ].sort();
    expect(names).toEqual(expected);
  });

  it("findTool returns the matching tool by name", () => {
    const t = findTool("searchRecipes");
    expect(t).toBeDefined();
    expect(t?.name).toBe("searchRecipes");
  });

  it("findTool returns undefined for unknown name", () => {
    expect(findTool("doesNotExist")).toBeUndefined();
  });

  it("each tool exposes a Zod input schema", () => {
    for (const tool of allTools) {
      expect(tool.inputSchema).toBeDefined();
      expect(typeof tool.inputSchema.parse).toBe("function");
    }
  });

  it("each tool exposes a status key", () => {
    for (const tool of allTools) {
      expect(tool.statusKey).toBeTruthy();
    }
  });
});

describe("filterToolsForContext (hybrid C+B Layer A)", () => {
  it("excludes Pro-only tools for a Free user", () => {
    const tools = filterToolsForContext(ctx(FREE));
    const names = tools.map((t) => t.name);
    // Tools without requiresFeature stay available even to Free users (e.g.
    // searchRecipes, getRecipe — read-only entry points).
    expect(names).toContain("searchRecipes");
    expect(names).toContain("getRecipe");
    // Pro-gated tools are filtered out.
    expect(names).not.toContain("createRecipe");
    expect(names).not.toContain("editRecipe");
    expect(names).not.toContain("deleteRecipe");
    expect(names).not.toContain("getNutrition");
    expect(names).not.toContain("importRecipeFromUrl");
    // Meal plan tools (all require aiChat feature)
    expect(names).not.toContain("searchMealPlans");
    expect(names).not.toContain("getMealPlan");
    expect(names).not.toContain("addMealToDay");
    expect(names).not.toContain("moveMeal");
    expect(names).not.toContain("updateMealServings");
    expect(names).not.toContain("removeMealFromDay");
  });

  it("exposes all tools to a Pro user", () => {
    const tools = filterToolsForContext(ctx(PRO));
    expect(tools).toHaveLength(allTools.length);
  });
});
