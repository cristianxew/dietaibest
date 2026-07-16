import type { LucideIcon } from "lucide-react";
import {
  CalendarPlus,
  CalendarRange,
  FileText,
  FlaskConical,
  Image as ImageIcon,
  Link as LinkIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { resolvePageArea, type PageArea } from "./page-context";

/**
 * Capability catalog — the single source of truth for "what can the chat do"
 * across every discovery surface (EmptyChat suggestions, follow-up chips,
 * Ask-DietAI entry points, the in-chat capability menu).
 *
 * CLIENT-SAFE BY CONTRACT: this module is imported by client components.
 * It must never import the tool registry (`./tools/*`), Prisma, or anything
 * that reads server env. Copy lives in i18n under `chat.capabilities.<id>.*`
 * (label / prompt / entityPrompt), not in the entries themselves.
 */

export type CapabilityId =
  | "createRecipeFromDescription"
  | "importRecipeFromLink"
  | "importRecipeFromPhoto"
  | "findRecipes"
  | "analyzeNutrition"
  | "generateRecipeImage"
  | "addRecipeToPlan"
  | "generateMealPlan"
  | "adjustMealPlan";

export type CapabilityGroup = "recipes" | "mealPlans" | "nutrition" | "import";

export interface Capability {
  id: CapabilityId;
  group: CapabilityGroup;
  icon: LucideIcon;
  /** Page areas where this ranks high. "global" entries pad every context. */
  contexts: ReadonlyArray<PageArea | "global">;
  /** Lower = earlier within a context. */
  priority: number;
  /** Has an i18n `entityPrompt` variant ("…this recipe") usable when the
   *  current page resolves to a recipe entity. */
  entityAware?: boolean;
  /** Tool the prompt primarily exercises — used only by consistency tests. */
  toolName?: string;
  /** Informational; actual gating stays in ChatContainer / the runtime. */
  requiresFeature?: "aiChat";
}

export const capabilities: ReadonlyArray<Capability> = [
  {
    id: "createRecipeFromDescription",
    group: "recipes",
    icon: FileText,
    contexts: ["global", "recipesList", "recipeNew", "dashboard"],
    priority: 10,
    toolName: "createRecipe",
    requiresFeature: "aiChat",
  },
  {
    id: "importRecipeFromLink",
    group: "import",
    icon: LinkIcon,
    contexts: ["global", "recipesList", "recipeNew", "dashboard"],
    priority: 20,
    toolName: "importRecipeFromUrl",
    requiresFeature: "aiChat",
  },
  {
    id: "importRecipeFromPhoto",
    group: "import",
    icon: ImageIcon,
    contexts: ["global", "recipesList", "recipeNew"],
    priority: 30,
    toolName: "importRecipeFromImage",
    requiresFeature: "aiChat",
  },
  {
    id: "generateMealPlan",
    group: "mealPlans",
    icon: CalendarRange,
    contexts: ["global", "mealPlans", "dashboard"],
    priority: 40,
    toolName: "generateMealPlan",
    requiresFeature: "aiChat",
  },
  {
    id: "analyzeNutrition",
    group: "nutrition",
    icon: FlaskConical,
    contexts: ["global", "recipeDetail", "recipeEdit", "nutrition"],
    priority: 50,
    entityAware: true,
    toolName: "getNutrition",
    requiresFeature: "aiChat",
  },
  {
    id: "generateRecipeImage",
    group: "recipes",
    icon: Sparkles,
    contexts: ["recipeDetail", "recipeEdit"],
    priority: 60,
    entityAware: true,
    toolName: "generateRecipeImage",
    requiresFeature: "aiChat",
  },
  {
    id: "addRecipeToPlan",
    group: "mealPlans",
    icon: CalendarPlus,
    contexts: ["recipeDetail", "mealPlans"],
    priority: 70,
    entityAware: true,
    toolName: "addMealToDay",
    requiresFeature: "aiChat",
  },
  {
    id: "adjustMealPlan",
    group: "mealPlans",
    icon: SlidersHorizontal,
    contexts: ["mealPlans"],
    priority: 80,
    toolName: "moveMeal",
    requiresFeature: "aiChat",
  },
  {
    id: "findRecipes",
    group: "recipes",
    icon: Search,
    contexts: ["mealPlans", "dashboard"],
    priority: 90,
    toolName: "searchRecipes",
  },
];

const byPriority = (a: Capability, b: Capability) => a.priority - b.priority;

/**
 * Rank capabilities for the page the user is on: area-specific entries first,
 * then global ones pad the list up to `max`.
 */
export function selectCapabilitiesForPath(
  pathname: string,
  locale: string,
  max = 5
): Capability[] {
  const { area } = resolvePageArea(pathname, locale);

  const inContext = capabilities
    .filter((c) => c.contexts.includes(area))
    .sort(byPriority);
  const globals = capabilities
    .filter((c) => c.contexts.includes("global") && !inContext.includes(c))
    .sort(byPriority);

  return [...inContext, ...globals].slice(0, max);
}

export function getCapability(id: CapabilityId): Capability {
  const cap = capabilities.find((c) => c.id === id);
  if (!cap) throw new Error(`Unknown capability: ${id}`);
  return cap;
}
