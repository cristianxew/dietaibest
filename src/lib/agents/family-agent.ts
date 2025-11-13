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
 * Family Agent - Ensures recipes match dietary restrictions, allergies, and family preferences
 */
export class FamilyAgent extends BaseAgent {
  role: AgentRole = "family";
  name = "Family Agent";
  description = "Filters recipes based on dietary restrictions, allergies, and family member preferences";

  /**
   * Analyze all recipes and filter based on dietary restrictions
   */
  async analyze(
    context: PlanningContext,
    recipes: Recipe[]
  ): Promise<AgentAnalysisResult> {
    const thoughts = [];
    const recipeScores: RecipeScore[] = [];

    thoughts.push(
      this.createThought(
        `Checking ${recipes.length} recipes against dietary restrictions`,
        "analysis",
        { recipeCount: recipes.length }
      )
    );

    // Get all dietary restrictions from user and family
    const allDietaryTypes = [...context.userProfile.dietaryType];
    const allAllergies = [...context.userProfile.allergies];

    context.familyMembers.forEach(member => {
      allAllergies.push(...member.dietaryNeeds);
    });

    // Remove duplicates
    const uniqueDietaryTypes = [...new Set(allDietaryTypes)];
    const uniqueAllergies = [...new Set(allAllergies)];

    if (uniqueDietaryTypes.length > 0) {
      thoughts.push(
        this.createThought(
          `Dietary restrictions: ${uniqueDietaryTypes.join(", ")}`,
          "info",
          { dietaryTypes: uniqueDietaryTypes }
        )
      );
    }

    if (uniqueAllergies.length > 0) {
      thoughts.push(
        this.createThought(
          `Allergens to avoid: ${uniqueAllergies.join(", ")}`,
          "info",
          { allergies: uniqueAllergies }
        )
      );
    }

    // Score each recipe
    let compatibleCount = 0;
    let rejectedCount = 0;

    for (const recipe of recipes) {
      const score = this.scoreRecipe(recipe, uniqueDietaryTypes, uniqueAllergies, context);
      recipeScores.push(score);

      if (score.score >= 50) {
        compatibleCount++;
      } else {
        rejectedCount++;
      }
    }

    thoughts.push(
      this.createThought(
        `Found ${compatibleCount} compatible recipes, rejected ${rejectedCount} due to restrictions`,
        "decision",
        { compatible: compatibleCount, rejected: rejectedCount }
      )
    );

    // Check if we have enough compatible recipes
    const totalMealsNeeded = context.duration * context.mealSlots.length;
    if (compatibleCount < totalMealsNeeded) {
      thoughts.push(
        this.createThought(
          `⚠️ Warning: Only ${compatibleCount} compatible recipes for ${totalMealsNeeded} meals. May need to reuse recipes.`,
          "conflict",
          { compatible: compatibleCount, needed: totalMealsNeeded }
        )
      );
    }

    return {
      recipeScores,
      thoughts,
      recommendations: {
        include: recipeScores.filter(r => r.score === 100).map(r => r.recipeId),
        avoid: recipeScores.filter(r => r.score < 50).map(r => r.recipeId),
        neutral: recipeScores.filter(r => r.score >= 50 && r.score < 100).map(r => r.recipeId),
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
    // Get all dietary restrictions
    const allDietaryTypes = [...context.userProfile.dietaryType];
    const allAllergies = [...context.userProfile.allergies];

    context.familyMembers.forEach(member => {
      allAllergies.push(...member.dietaryNeeds);
    });

    const uniqueDietaryTypes = [...new Set(allDietaryTypes)];
    const uniqueAllergies = [...new Set(allAllergies)];

    // Score all candidates
    const scored = candidates.map(recipe => ({
      recipe,
      score: this.scoreRecipe(recipe, uniqueDietaryTypes, uniqueAllergies, context).score,
    }));

    // Sort and pick best (that's compatible)
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];

    const isFullyCompatible = best.score === 100;

    return {
      agent: this.role,
      preferredRecipeId: best.recipe.id,
      score: best.score,
      reasoning: isFullyCompatible
        ? "Fully compatible with all dietary restrictions"
        : `Acceptable match (${best.score}/100) - some minor concerns`,
    };
  }

  /**
   * Score a single recipe based on dietary compatibility
   */
  private scoreRecipe(
    recipe: Recipe,
    dietaryTypes: string[],
    allergies: string[],
    context: PlanningContext
  ): RecipeScore {
    const pros: string[] = [];
    const cons: string[] = [];
    let score = 100; // Start with perfect score, deduct for issues

    // Check for allergens (critical - major deduction)
    if (this.containsAllergens(recipe, allergies)) {
      cons.push("❌ Contains allergens");
      score = 0; // Immediate disqualification
      return {
        recipeId: recipe.id,
        score,
        reasoning: "Recipe contains allergens - not safe",
        pros,
        cons,
      };
    } else if (allergies.length > 0) {
      pros.push("✓ Allergen-free");
    }

    // Check dietary restrictions
    if (dietaryTypes.length > 0) {
      const matches = this.matchesDietaryRestrictions(recipe, dietaryTypes);
      if (!matches) {
        cons.push(`Doesn't match dietary type: ${dietaryTypes.join(", ")}`);
        score -= 40; // Major deduction but not disqualifying
      } else {
        pros.push(`✓ Matches ${dietaryTypes.join(", ")}`);
      }
    }

    // Check cuisine preferences (minor scoring)
    if (context.userProfile.cuisinePrefs.length > 0) {
      const recipeTags = (recipe.tags || []).map(tag => tag.toLowerCase());
      const matchesCuisine = context.userProfile.cuisinePrefs.some(pref =>
        recipeTags.some(tag => tag.includes(pref.toLowerCase()))
      );

      if (matchesCuisine) {
        pros.push("✓ Matches cuisine preference");
        score += 5;
      } else {
        // Don't penalize, just don't bonus
      }
    }

    // Ensure score is between 0-100
    score = Math.max(0, Math.min(100, score));

    return {
      recipeId: recipe.id,
      score,
      reasoning: score === 100
        ? "Perfect match for all dietary requirements"
        : score >= 50
        ? "Compatible with dietary requirements"
        : "Not compatible with dietary requirements",
      pros,
      cons,
    };
  }
}
