import type { AnyTool } from "./types";
import type { AgentContext } from "../context";
import { searchRecipes } from "./searchRecipes";
import { getRecipe } from "./getRecipe";
import { createRecipe } from "./createRecipe";
import { editRecipe } from "./editRecipe";
import { deleteRecipe } from "./deleteRecipe";
import { getNutrition } from "./getNutrition";
import { importRecipeFromUrl } from "./importRecipeFromUrl";
import { importRecipeFromImage } from "./importRecipeFromImage";
import { searchMealPlans } from "./searchMealPlans";
import { getMealPlan } from "./getMealPlan";
import { addMealToDay } from "./addMealToDay";
import { moveMeal } from "./moveMeal";
import { updateMealServings } from "./updateMealServings";
import { removeMealFromDay } from "./removeMealFromDay";
import { generateMealPlan } from "./generateMealPlan";
import { generateRecipeImage } from "./generateRecipeImage";

export type { Tool, ToolResult, AnyTool } from "./types";

// DIE-41: gate importRecipeFromImage behind FEATURE_MULTIMODAL_IMPORT. Ship
// the full infra OFF; flip the flag once the 20-item Gemma quality eval clears
// the >=80%/>=70% bar (tests/eval/gemma-image-import.ts). When the flag is
// false the tool isn't even in the registry, so the LLM never sees it.
function isMultimodalImportEnabled(): boolean {
  return process.env.FEATURE_MULTIMODAL_IMPORT === "true";
}

/**
 * Source of truth for every tool the agent can call. Each tool is a plain
 * object — no AI SDK or MCP imports inside the definitions themselves — so
 * the same registry feeds the in-app runtime today and the MCP server in v1.1.
 */
export const allTools: ReadonlyArray<AnyTool> = [
  searchRecipes,
  getRecipe,
  createRecipe,
  editRecipe,
  deleteRecipe,
  getNutrition,
  importRecipeFromUrl,
  ...(isMultimodalImportEnabled() ? [importRecipeFromImage] : []),
  searchMealPlans,
  getMealPlan,
  addMealToDay,
  moveMeal,
  updateMealServings,
  removeMealFromDay,
  generateMealPlan,
  generateRecipeImage,
];

/**
 * Proactive entitlement filter (Layer A of the hybrid C+B strategy).
 * Filters allTools to what the user can call this turn based on their
 * feature flags. The dispatcher still re-checks defensively at call time
 * because v1.1 MCP runs under OAuth, not session cookies.
 */
export function filterToolsForContext(ctx: AgentContext): AnyTool[] {
  return allTools.filter((tool) => {
    if (!tool.requiresFeature) return true;
    return ctx.entitlements.features[tool.requiresFeature] === true;
  });
}

export function findTool(name: string): AnyTool | undefined {
  return allTools.find((t) => t.name === name);
}
