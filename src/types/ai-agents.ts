import type { Recipe } from "@/generated/prisma";
import type { MealType, MacroTarget, MacroSummary } from "./meal-plan";

// ============================================================================
// Agent System Types
// ============================================================================

/**
 * Agent role types in the meal planning system
 */
export type AgentRole =
  | "coordinator"
  | "nutrition"
  | "family"
  | "budget"
  | "sustainability";

/**
 * Agent thinking/reasoning log entry
 */
export interface AgentThought {
  agent: AgentRole;
  agentName: string;
  timestamp: Date;
  message: string;
  type: "analysis" | "decision" | "conflict" | "suggestion" | "info";
  data?: Record<string, unknown>;
}

/**
 * Context for meal plan generation
 */
export interface PlanningContext {
  userId: string;
  templateId: string;
  duration: number; // days
  mealSlots: MealType[];
  targets: MacroTarget;
  userProfile: {
    dietaryType: string[]; // vegetarian, vegan, keto, etc.
    allergies: string[];
    cuisinePrefs: string[];
    dailyCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  familyMembers: {
    name: string;
    dietaryNeeds: string[];
  }[];
  availableRecipes: Recipe[];
}

/**
 * Recipe score from an agent's perspective
 */
export interface RecipeScore {
  recipeId: string;
  score: number; // 0-100
  reasoning: string;
  pros: string[];
  cons: string[];
}

/**
 * Meal suggestion for a specific slot
 */
export interface MealSuggestion {
  dayNumber: number;
  mealType: MealType;
  recipeId: string;
  recipeName: string;
  servings: number;
  macros: MacroSummary;
  reasoning: string;
  confidence: number; // 0-1
  agentScores: {
    nutrition: number;
    family: number;
    overall: number;
  };
}

/**
 * Complete AI-generated meal plan
 */
export interface AIGeneratedPlan {
  suggestions: MealSuggestion[];
  averageDailyMacros: MacroSummary;
  totalMacros: MacroSummary;
  matchPercentage: number; // How well it matches user goals (0-100)
  reasoning: string[];
  agentThoughts: AgentThought[];
}

/**
 * Agent decision/vote for conflict resolution
 */
export interface AgentDecision {
  agent: AgentRole;
  preferredRecipeId: string;
  score: number;
  reasoning: string;
}

/**
 * Conflict when agents disagree
 */
export interface AgentConflict {
  dayNumber: number;
  mealType: MealType;
  conflictingRecipes: string[];
  decisions: AgentDecision[];
  resolution?: string; // Coordinator's final decision
}

/**
 * Result of agent analysis
 */
export interface AgentAnalysisResult {
  recipeScores: RecipeScore[];
  thoughts: AgentThought[];
  recommendations: {
    include: string[]; // Recipe IDs to definitely include
    avoid: string[]; // Recipe IDs to avoid
    neutral: string[]; // Recipe IDs that are acceptable
  };
}

/**
 * Base interface for all agents
 */
export interface IAgent {
  role: AgentRole;
  name: string;
  description: string;

  /**
   * Analyze recipes and provide scores
   */
  analyze(
    context: PlanningContext,
    recipes: Recipe[]
  ): Promise<AgentAnalysisResult>;

  /**
   * Vote on a specific meal slot decision
   */
  vote(
    context: PlanningContext,
    dayNumber: number,
    mealType: MealType,
    candidates: Recipe[]
  ): Promise<AgentDecision>;
}

/**
 * Streaming update during AI generation
 */
export interface StreamingUpdate {
  type: "thought" | "suggestion" | "progress" | "complete" | "error";
  data: AgentThought | MealSuggestion | { percent: number } | AIGeneratedPlan;
  timestamp: Date;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Recipe with calculated compatibility scores
 */
export interface ScoredRecipe extends Recipe {
  scores: {
    nutrition: number;
    family: number;
    budget?: number;
    sustainability?: number;
    overall: number;
  };
  reasoning: string[];
}

/**
 * Day plan during generation
 */
export interface DayPlan {
  dayNumber: number;
  meals: {
    [key in MealType]?: {
      recipe: Recipe;
      servings: number;
      reasoning: string;
    };
  };
  macros: MacroSummary;
}

/**
 * Weekly plan structure
 */
export interface WeeklyPlan {
  days: DayPlan[];
  totalMacros: MacroSummary;
  averageDailyMacros: MacroSummary;
  variety: {
    uniqueRecipes: number;
    totalMeals: number;
    varietyScore: number; // 0-100
  };
}
