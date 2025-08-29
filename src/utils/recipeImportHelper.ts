import { RecipeFormData } from "@/types/recipe";

/**
 * Analyzes nutrition for an imported recipe
 * @param recipeData - The imported recipe data
 * @returns Recipe data with nutrition information
 */
export async function analyzeImportedRecipeNutrition(
  recipeData: RecipeFormData
): Promise<RecipeFormData> {
  try {
    // Skip if ingredients are not available
    if (!recipeData.ingredients || recipeData.ingredients.length === 0) {
      return recipeData;
    }

    // Format ingredients for the API
    const ingredientStrings = recipeData.ingredients.map((ing) => {
      const parts = [];
      if (ing.amount) parts.push(ing.amount);
      if (ing.unit) parts.push(ing.unit);
      parts.push(ing.name);
      return parts.join(" ");
    });

    // Call nutrition analysis API
    const response = await fetch("/api/nutrition/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ingredients: ingredientStrings,
        servings: recipeData.servings || 1,
        options: {
          includeNutrition: true,
          includeDiets: false,
          includeAllergens: false,
          includeConfidence: true,
          strictMode: false,
        },
      }),
    });

    if (!response.ok) {
      console.error("Failed to analyze nutrition for imported recipe");
      return recipeData;
    }

    const result = await response.json();

    if (result.success && result.data?.nutrition) {
      const nutrients = result.data.nutrition.perServing;

      // Find and extract main macronutrients
      const findNutrientValue = (name: string) => {
        const nutrient = nutrients.find(
          (n: { nutrient: { name: string }; value: number }) =>
            n.nutrient.name.toLowerCase().includes(name.toLowerCase())
        );
        return nutrient ? nutrient.value : undefined;
      };

      // Return recipe data with nutrition values
      return {
        ...recipeData,
        calories:
          findNutrientValue("calories") ||
          findNutrientValue("energy") ||
          recipeData.calories,
        protein: findNutrientValue("protein") || recipeData.protein,
        carbs: findNutrientValue("carbohydrate") || recipeData.carbs,
        fat: findNutrientValue("fat") || recipeData.fat,
        fiber: findNutrientValue("fiber") || recipeData.fiber,
        sugar: findNutrientValue("sugar") || recipeData.sugar,
        sodium: findNutrientValue("sodium") || recipeData.sodium,
      };
    }

    return recipeData;
  } catch (error) {
    console.error("Error analyzing nutrition for imported recipe:", error);
    // Return original data if analysis fails
    return recipeData;
  }
}
