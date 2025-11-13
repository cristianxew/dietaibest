import { BaseAgent } from "./base-agent";
import type {
  AgentRole,
  PlanningContext,
  AgentAnalysisResult,
  AgentDecision,
  RecipeScore,
} from "@/types/ai-agents";
import type { Recipe } from "@/generated/prisma";
import type { MealType } from "@/types/meal-plan";

/**
 * Nutrition Agent - Optimizes meal plans for macro targets and nutritional balance
 */
export class NutritionAgent extends BaseAgent {
  role: AgentRole = "nutrition";
  name = "Nutrition Agent";
  description = "Optimizes meals for macro targets, calorie goals, and nutritional balance";

  /**
   * Analyze all recipes and score based on nutritional value
   */
  async analyze(
    context: PlanningContext,
    recipes: Recipe[]
  ): Promise<AgentAnalysisResult> {
    const thoughts = [];
    const recipeScores: RecipeScore[] = [];

    thoughts.push(
      this.createThought(
        `Analyzing ${recipes.length} recipes for nutritional value`,
        "analysis",
        { recipeCount: recipes.length }
      )
    );

    // Calculate target macros per meal
    const mealsPerDay = context.mealSlots.length;
    const targetPerMeal = {
      calories: context.targets.calories ? context.targets.calories / mealsPerDay : undefined,
      protein: context.targets.protein ? context.targets.protein / mealsPerDay : undefined,
      carbs: context.targets.carbs ? context.targets.carbs / mealsPerDay : undefined,
      fat: context.targets.fat ? context.targets.fat / mealsPerDay : undefined,
    };

    thoughts.push(
      this.createThought(
        `Target per meal: ${Math.round(targetPerMeal.calories || 0)} cal, ${Math.round(targetPerMeal.protein || 0)}g protein`,
        "info",
        { targetPerMeal }
      )
    );

    // Score each recipe
    for (const recipe of recipes) {
      const score = this.scoreRecipe(recipe, targetPerMeal, context);
      recipeScores.push(score);
    }

    // Sort by score
    recipeScores.sort((a, b) => b.score - a.score);

    // Categorize recipes
    const highScore = recipeScores.filter(r => r.score >= 70);
    const mediumScore = recipeScores.filter(r => r.score >= 40 && r.score < 70);
    const lowScore = recipeScores.filter(r => r.score < 40);

    thoughts.push(
      this.createThought(
        `Found ${highScore.length} high-quality recipes (score ≥70)`,
        "suggestion",
        { highScore: highScore.length, mediumScore: mediumScore.length, lowScore: lowScore.length }
      )
    );

    // Identify high-protein recipes for special mention
    const highProteinRecipes = recipes.filter(r => r.protein && r.protein > (targetPerMeal.protein || 20));
    if (highProteinRecipes.length > 0) {
      thoughts.push(
        this.createThought(
          `Identified ${highProteinRecipes.length} high-protein recipes (>${Math.round(targetPerMeal.protein || 20)}g)`,
          "info",
          { count: highProteinRecipes.length }
        )
      );
    }

    return {
      recipeScores,
      thoughts,
      recommendations: {
        include: highScore.slice(0, 10).map(r => r.recipeId), // Top 10
        avoid: lowScore.map(r => r.recipeId),
        neutral: mediumScore.map(r => r.recipeId),
      },
    };
  }

  /**
   * Vote on a specific meal slot
   */
  async vote(
    context: PlanningContext,
    dayNumber: number,
    mealType: MealType,
    candidates: Recipe[]
  ): Promise<AgentDecision> {
    const mealsPerDay = context.mealSlots.length;
    const targetPerMeal = {
      calories: context.targets.calories ? context.targets.calories / mealsPerDay : undefined,
      protein: context.targets.protein ? context.targets.protein / mealsPerDay : undefined,
      carbs: context.targets.carbs ? context.targets.carbs / mealsPerDay : undefined,
      fat: context.targets.fat ? context.targets.fat / mealsPerDay : undefined,
    };

    // Score all candidates
    const scored = candidates.map(recipe => ({
      recipe,
      score: this.scoreRecipe(recipe, targetPerMeal, context).score,
    }));

    // Sort and pick best
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    return {
      agent: this.role,
      preferredRecipeId: best.recipe.id,
      score: best.score,
      reasoning: `Best macro match: ${Math.round(best.recipe.calories || 0)} cal, ${Math.round(best.recipe.protein || 0)}g protein (score: ${best.score}/100)`,
    };
  }

  /**
   * Score a single recipe based on nutritional value
   */
  private scoreRecipe(
    recipe: Recipe,
    targetPerMeal: { calories?: number; protein?: number; carbs?: number; fat?: number },
    context: PlanningContext
  ): RecipeScore {
    const pros: string[] = [];
    const cons: string[] = [];
    let score = 50; // Base score

    // Check if recipe has nutrition data
    if (!recipe.calories || !recipe.protein) {
      return {
        recipeId: recipe.id,
        score: 0,
        reasoning: "No nutritional data available",
        pros: [],
        cons: ["Missing nutritional information"],
      };
    }

    // Calculate macro match
    const macroMatch = this.calculateMacroMatch(
      {
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
      },
      targetPerMeal,
      recipe.servings
    );

    score = macroMatch;

    if (macroMatch >= 80) {
      pros.push("Excellent macro match");
    } else if (macroMatch >= 60) {
      pros.push("Good macro match");
    } else if (macroMatch < 40) {
      cons.push("Poor macro match");
    }

    // Check protein content
    const proteinPerServing = recipe.protein / recipe.servings;
    if (targetPerMeal.protein) {
      if (proteinPerServing >= targetPerMeal.protein * 0.8) {
        pros.push(`High protein: ${Math.round(proteinPerServing)}g`);
        score += 10;
      } else if (proteinPerServing < targetPerMeal.protein * 0.5) {
        cons.push(`Low protein: ${Math.round(proteinPerServing)}g`);
        score -= 10;
      }
    }

    // Check calorie content
    const caloriesPerServing = recipe.calories / recipe.servings;
    if (targetPerMeal.calories) {
      const calorieDiff = Math.abs(caloriesPerServing - targetPerMeal.calories);
      if (calorieDiff < targetPerMeal.calories * 0.15) {
        pros.push("Perfect calorie level");
        score += 5;
      } else if (calorieDiff > targetPerMeal.calories * 0.4) {
        cons.push("Calorie mismatch");
        score -= 10;
      }
    }

    // Check fiber content
    if (recipe.fiber) {
      const fiberPerServing = recipe.fiber / recipe.servings;
      if (fiberPerServing >= 5) {
        pros.push(`High fiber: ${Math.round(fiberPerServing)}g`);
        score += 5;
      }
    }

    // Ensure score is between 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      recipeId: recipe.id,
      score,
      reasoning: `Macro match: ${Math.round(macroMatch)}% | ${Math.round(caloriesPerServing)} cal, ${Math.round(proteinPerServing)}g protein per serving`,
      pros,
      cons,
    };
  }
}
