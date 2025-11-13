import type {
  IAgent,
  AgentRole,
  PlanningContext,
  AgentAnalysisResult,
  AgentDecision,
  AgentThought,
  RecipeScore,
} from "@/types/ai-agents";
import type { Recipe } from "@/generated/prisma";
import type { MealType } from "@/types/meal-plan";

/**
 * Base Agent class with shared utilities
 */
export abstract class BaseAgent implements IAgent {
  abstract role: AgentRole;
  abstract name: string;
  abstract description: string;

  /**
   * Analyze recipes - must be implemented by subclasses
   */
  abstract analyze(
    context: PlanningContext,
    recipes: Recipe[]
  ): Promise<AgentAnalysisResult>;

  /**
   * Vote on a specific meal slot decision - must be implemented by subclasses
   */
  abstract vote(
    context: PlanningContext,
    dayNumber: number,
    mealType: MealType,
    candidates: Recipe[]
  ): Promise<AgentDecision>;

  /**
   * Helper: Create a thought/reasoning entry
   */
  protected createThought(
    message: string,
    type: AgentThought["type"] = "info",
    data?: Record<string, unknown>
  ): AgentThought {
    return {
      agent: this.role,
      agentName: this.name,
      timestamp: new Date(),
      message,
      type,
      data,
    };
  }

  /**
   * Helper: Calculate macro match percentage
   */
  protected calculateMacroMatch(
    recipeMacros: { calories?: number | null; protein?: number | null; carbs?: number | null; fat?: number | null },
    targets: { calories?: number; protein?: number; carbs?: number; fat?: number },
    servings: number = 1
  ): number {
    const scores: number[] = [];

    if (targets.calories && recipeMacros.calories) {
      const actual = (recipeMacros.calories / servings);
      const target = targets.calories;
      const diff = Math.abs(actual - target) / target;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    if (targets.protein && recipeMacros.protein) {
      const actual = (recipeMacros.protein / servings);
      const target = targets.protein;
      const diff = Math.abs(actual - target) / target;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    if (targets.carbs && recipeMacros.carbs) {
      const actual = (recipeMacros.carbs / servings);
      const target = targets.carbs;
      const diff = Math.abs(actual - target) / target;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    if (targets.fat && recipeMacros.fat) {
      const actual = (recipeMacros.fat / servings);
      const target = targets.fat;
      const diff = Math.abs(actual - target) / target;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    return scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 0;
  }

  /**
   * Helper: Check if recipe matches dietary restrictions
   */
  protected matchesDietaryRestrictions(
    recipe: Recipe,
    dietaryTypes: string[]
  ): boolean {
    // For now, we'll use tag-based matching
    // In production, this would integrate with Edamam's diet labels
    const recipeTags = (recipe.tags || []).map(tag => tag.toLowerCase());

    for (const dietaryType of dietaryTypes) {
      const type = dietaryType.toLowerCase();

      // Vegetarian check
      if (type === "vegetarian") {
        const hasVegetarianTag = recipeTags.some(tag =>
          tag.includes("vegetarian") || tag.includes("veggie")
        );
        if (!hasVegetarianTag) {
          // Check if recipe contains meat keywords
          const meatKeywords = ["chicken", "beef", "pork", "fish", "meat", "turkey", "lamb"];
          const recipeText = `${recipe.title} ${recipe.description || ""}`.toLowerCase();
          if (meatKeywords.some(keyword => recipeText.includes(keyword))) {
            return false;
          }
        }
      }

      // Vegan check
      if (type === "vegan") {
        const hasVeganTag = recipeTags.some(tag => tag.includes("vegan"));
        if (!hasVeganTag) {
          const animalKeywords = ["chicken", "beef", "pork", "fish", "meat", "dairy", "egg", "cheese", "milk"];
          const recipeText = `${recipe.title} ${recipe.description || ""}`.toLowerCase();
          if (animalKeywords.some(keyword => recipeText.includes(keyword))) {
            return false;
          }
        }
      }

      // Keto check
      if (type === "keto") {
        if (recipe.carbs && recipe.carbs > 15) {
          return false; // Too high carb for keto
        }
      }

      // Paleo check
      if (type === "paleo") {
        const nonPaleoKeywords = ["grain", "wheat", "rice", "pasta", "bread", "dairy"];
        const recipeText = `${recipe.title} ${recipe.description || ""}`.toLowerCase();
        if (nonPaleoKeywords.some(keyword => recipeText.includes(keyword))) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Helper: Check if recipe contains allergens
   */
  protected containsAllergens(recipe: Recipe, allergies: string[]): boolean {
    if (allergies.length === 0) return false;

    const recipeText = `${recipe.title} ${recipe.description || ""}`.toLowerCase();

    for (const allergen of allergies) {
      const allergenLower = allergen.toLowerCase();
      if (recipeText.includes(allergenLower)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper: Calculate variety score (penalize repeated recipes)
   */
  protected calculateVarietyPenalty(
    recipeId: string,
    usedRecipeIds: string[]
  ): number {
    const useCount = usedRecipeIds.filter(id => id === recipeId).length;
    if (useCount === 0) return 0;
    if (useCount === 1) return 10; // Small penalty for using twice
    if (useCount === 2) return 25; // Larger penalty for using 3 times
    return 50; // Heavy penalty for using 4+ times
  }
}
