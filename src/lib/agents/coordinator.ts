import { NutritionAgent } from "./nutrition-agent";
import { FamilyAgent } from "./family-agent";
import type {
  PlanningContext,
  AIGeneratedPlan,
  MealSuggestion,
  AgentThought,
  ScoredRecipe,
  DayPlan,
} from "@/types/ai-agents";
import type { Recipe } from "@/generated/prisma";
import type { MealType, MacroSummary } from "@/types/meal-plan";

/**
 * Coordinator Agent - Orchestrates all specialist agents and generates final meal plan
 */
export class CoordinatorAgent {
  private nutritionAgent: NutritionAgent;
  private familyAgent: FamilyAgent;
  private thoughts: AgentThought[] = [];

  constructor() {
    this.nutritionAgent = new NutritionAgent();
    this.familyAgent = new FamilyAgent();
  }

  /**
   * Generate a complete meal plan using multi-agent collaboration
   */
  async generateMealPlan(context: PlanningContext): Promise<AIGeneratedPlan> {
    this.thoughts = [];

    this.addThought(
      "coordinator",
      `🎯 Starting meal plan generation: ${context.duration} days, ${context.mealSlots.length} meals/day`,
      "analysis"
    );

    // Step 1: Run agent analysis in parallel
    this.addThought(
      "coordinator",
      "Delegating analysis to specialist agents...",
      "info"
    );

    const [nutritionResult, familyResult] = await Promise.all([
      this.nutritionAgent.analyze(context, context.availableRecipes),
      this.familyAgent.analyze(context, context.availableRecipes),
    ]);

    // Merge thoughts from agents
    this.thoughts.push(...nutritionResult.thoughts);
    this.thoughts.push(...familyResult.thoughts);

    // Step 2: Combine scores from both agents
    this.addThought(
      "coordinator",
      "Combining scores from nutrition and family agents...",
      "analysis"
    );

    const scoredRecipes = this.combineAgentScores(
      context.availableRecipes,
      nutritionResult.recipeScores,
      familyResult.recipeScores
    );

    // Filter out recipes that are incompatible (family agent scored < 50)
    const compatibleRecipes = scoredRecipes.filter(r => r.scores.family >= 50);

    if (compatibleRecipes.length === 0) {
      this.addThought(
        "coordinator",
        "❌ No compatible recipes found with current restrictions",
        "error"
      );

      throw new Error(
        "No compatible recipes found. Please adjust dietary restrictions or add more recipes."
      );
    }

    this.addThought(
      "coordinator",
      `Found ${compatibleRecipes.length} compatible recipes to work with`,
      "decision"
    );

    // Step 3: Generate day-by-day meal plan
    const suggestions = await this.generateDayPlans(context, compatibleRecipes);

    // Step 4: Calculate overall metrics
    const { averageDailyMacros, totalMacros } = this.calculatePlanMacros(suggestions, context);

    // Step 5: Calculate match percentage
    const matchPercentage = this.calculateMatchPercentage(
      averageDailyMacros,
      context.targets
    );

    this.addThought(
      "coordinator",
      `✅ Plan complete! ${matchPercentage}% match to goals`,
      "decision",
      { matchPercentage, averageDailyMacros }
    );

    // Generate reasoning summary
    const reasoning = this.generateReasoningSummary(
      suggestions,
      matchPercentage,
      context
    );

    return {
      suggestions,
      averageDailyMacros,
      totalMacros,
      matchPercentage,
      reasoning,
      agentThoughts: this.thoughts,
    };
  }

  /**
   * Combine scores from multiple agents
   */
  private combineAgentScores(
    recipes: Recipe[],
    nutritionScores: Array<{ recipeId: string; score: number }>,
    familyScores: Array<{ recipeId: string; score: number }>
  ): ScoredRecipe[] {
    return recipes.map(recipe => {
      const nutritionScore =
        nutritionScores.find(s => s.recipeId === recipe.id)?.score || 0;
      const familyScore =
        familyScores.find(s => s.recipeId === recipe.id)?.score || 0;

      // Weighted average: Family (dietary restrictions) is critical
      // Family score is binary-ish (compatible or not)
      // So we weight it higher: 60% family, 40% nutrition
      const overall = familyScore * 0.6 + nutritionScore * 0.4;

      return {
        ...recipe,
        scores: {
          nutrition: nutritionScore,
          family: familyScore,
          overall,
        },
        reasoning: [],
      };
    });
  }

  /**
   * Generate meal suggestions for each day and meal slot
   */
  private async generateDayPlans(
    context: PlanningContext,
    scoredRecipes: ScoredRecipe[]
  ): Promise<MealSuggestion[]> {
    const suggestions: MealSuggestion[] = [];
    const usedRecipeIds: string[] = [];

    // Sort recipes by overall score
    const sortedRecipes = [...scoredRecipes].sort(
      (a, b) => b.scores.overall - a.scores.overall
    );

    this.addThought(
      "coordinator",
      "Planning meals day by day...",
      "info"
    );

    for (let day = 1; day <= context.duration; day++) {
      for (const mealType of context.mealSlots) {
        // Select best recipe for this meal slot
        const selectedRecipe = this.selectRecipeForMeal(
          sortedRecipes,
          usedRecipeIds,
          mealType,
          context
        );

        if (!selectedRecipe) {
          this.addThought(
            "coordinator",
            `⚠️ Could not find suitable recipe for Day ${day} ${mealType}`,
            "conflict"
          );
          continue;
        }

        usedRecipeIds.push(selectedRecipe.id);

        const suggestion: MealSuggestion = {
          dayNumber: day,
          mealType,
          recipeId: selectedRecipe.id,
          recipeName: selectedRecipe.title,
          servings: selectedRecipe.servings,
          macros: {
            calories: selectedRecipe.calories || 0,
            protein: selectedRecipe.protein || 0,
            carbs: selectedRecipe.carbs || 0,
            fat: selectedRecipe.fat || 0,
          },
          reasoning: this.generateMealReasoning(selectedRecipe, usedRecipeIds),
          confidence: selectedRecipe.scores.overall / 100,
          agentScores: {
            nutrition: selectedRecipe.scores.nutrition,
            family: selectedRecipe.scores.family,
            overall: selectedRecipe.scores.overall,
          },
        };

        suggestions.push(suggestion);
      }
    }

    return suggestions;
  }

  /**
   * Select best recipe for a specific meal slot
   */
  private selectRecipeForMeal(
    recipes: ScoredRecipe[],
    usedRecipeIds: string[],
    mealType: MealType,
    context: PlanningContext
  ): ScoredRecipe | null {
    // Adjust scores based on variety (penalize recently used recipes)
    const recipesWithVarietyScore = recipes.map(recipe => {
      const varietyPenalty = this.calculateVarietyPenalty(recipe.id, usedRecipeIds);
      const adjustedScore = recipe.scores.overall - varietyPenalty;

      return {
        ...recipe,
        adjustedScore,
      };
    });

    // Sort by adjusted score
    recipesWithVarietyScore.sort((a, b) => b.adjustedScore - a.adjustedScore);

    // Return top recipe
    return recipesWithVarietyScore[0] || null;
  }

  /**
   * Calculate variety penalty (helper from base agent)
   */
  private calculateVarietyPenalty(recipeId: string, usedRecipeIds: string[]): number {
    const useCount = usedRecipeIds.filter(id => id === recipeId).length;
    if (useCount === 0) return 0;
    if (useCount === 1) return 15; // Penalty for using twice
    if (useCount === 2) return 35; // Larger penalty for using 3 times
    return 60; // Heavy penalty for using 4+ times
  }

  /**
   * Generate reasoning for a meal suggestion
   */
  private generateMealReasoning(
    recipe: ScoredRecipe,
    usedRecipeIds: string[]
  ): string {
    const reasons: string[] = [];

    if (recipe.scores.nutrition >= 80) {
      reasons.push("Excellent macro match");
    }

    if (recipe.scores.family === 100) {
      reasons.push("Perfect dietary fit");
    }

    const useCount = usedRecipeIds.filter(id => id === recipe.id).length;
    if (useCount === 0) {
      reasons.push("First time in plan");
    } else if (useCount === 1) {
      reasons.push("Second use (variety)");
    }

    return reasons.join(" • ");
  }

  /**
   * Calculate overall plan macros
   */
  private calculatePlanMacros(
    suggestions: MealSuggestion[],
    context: PlanningContext
  ): { averageDailyMacros: MacroSummary; totalMacros: MacroSummary } {
    const totalMacros = suggestions.reduce(
      (sum, meal) => ({
        calories: sum.calories + meal.macros.calories,
        protein: sum.protein + meal.macros.protein,
        carbs: sum.carbs + meal.macros.carbs,
        fat: sum.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    const averageDailyMacros = {
      calories: totalMacros.calories / context.duration,
      protein: totalMacros.protein / context.duration,
      carbs: totalMacros.carbs / context.duration,
      fat: totalMacros.fat / context.duration,
    };

    return { averageDailyMacros, totalMacros };
  }

  /**
   * Calculate how well the plan matches target goals
   */
  private calculateMatchPercentage(
    actual: MacroSummary,
    targets: { calories?: number; protein?: number; carbs?: number; fat?: number }
  ): number {
    const scores: number[] = [];

    if (targets.calories) {
      const diff = Math.abs(actual.calories - targets.calories) / targets.calories;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    if (targets.protein) {
      const diff = Math.abs(actual.protein - targets.protein) / targets.protein;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    if (targets.carbs) {
      const diff = Math.abs(actual.carbs - targets.carbs) / targets.carbs;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    if (targets.fat) {
      const diff = Math.abs(actual.fat - targets.fat) / targets.fat;
      scores.push(Math.max(0, 100 - diff * 100));
    }

    return scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : 100;
  }

  /**
   * Generate human-readable reasoning summary
   */
  private generateReasoningSummary(
    suggestions: MealSuggestion[],
    matchPercentage: number,
    context: PlanningContext
  ): string[] {
    const summary: string[] = [];

    summary.push(`Generated ${suggestions.length} meal suggestions across ${context.duration} days`);
    summary.push(`Overall goal match: ${matchPercentage}%`);

    // Count unique recipes
    const uniqueRecipes = new Set(suggestions.map(s => s.recipeId)).size;
    const varietyPercentage = Math.round((uniqueRecipes / suggestions.length) * 100);
    summary.push(`Recipe variety: ${uniqueRecipes} unique recipes (${varietyPercentage}% variety)`);

    // Check dietary compliance
    const hasRestrictedDiet = context.userProfile.dietaryType.length > 0;
    if (hasRestrictedDiet) {
      summary.push(`All meals comply with ${context.userProfile.dietaryType.join(", ")} diet`);
    }

    return summary;
  }

  /**
   * Helper to add coordinator thoughts
   */
  private addThought(
    agent: "coordinator",
    message: string,
    type: AgentThought["type"] = "info",
    data?: Record<string, unknown>
  ): void {
    this.thoughts.push({
      agent,
      agentName: "Coordinator",
      timestamp: new Date(),
      message,
      type,
      data,
    });
  }
}
