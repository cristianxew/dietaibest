/**
 * Advanced Nutrition Analysis Service
 *
 * Provides comprehensive nutritional analysis for recipes including:
 * - Detailed macro and micronutrient calculations
 * - Integration with external nutrition APIs (when available)
 * - Recipe portion analysis and scaling
 * - Nutritional goal matching and recommendations
 */

import { Ingredient } from "@/types/recipe";
import { MacroTargets } from "@/utils/macroCalculator";

// Extended nutrition profile interface
export interface DetailedNutritionProfile {
  // Basic macros (per serving)
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;

  // Additional macros
  fiber: number;
  sugar: number;
  saturatedFat: number;
  unsaturatedFat: number;

  // Micronutrients (mg unless noted)
  sodium: number;
  potassium: number;
  calcium: number;
  iron: number;
  vitaminC: number;
  vitaminA: number; // IU
  vitaminD: number; // IU
  vitaminB12: number; // mcg
  folate: number; // mcg

  // Additional metrics
  cholesterol: number; // mg
  glycemicIndex: number; // 0-100 estimated
  inflammatoryScore: number; // -100 to +100 (anti-inflammatory to inflammatory)

  // Quality scores
  nutritionDensity: number; // 0-100
  proteinQuality: number; // 0-100
  antioxidantScore: number; // 0-100
}

// Comprehensive nutrition database with detailed nutritional profiles
const COMPREHENSIVE_NUTRITION_DB: Record<
  string,
  Partial<DetailedNutritionProfile> & {
    category: string;
    commonUnit: string;
    density?: number; // g/ml for volume conversions
  }
> = {
  // Proteins - High quality complete proteins
  "chicken breast": {
    calories: 165,
    protein: 31,
    carbohydrates: 0,
    fat: 3.6,
    saturatedFat: 1,
    fiber: 0,
    sodium: 74,
    potassium: 256,
    iron: 0.7,
    vitaminB12: 0.3,
    cholesterol: 85,
    category: "lean-protein",
    commonUnit: "g",
    proteinQuality: 95,
    glycemicIndex: 0,
    inflammatoryScore: -10,
  },

  salmon: {
    calories: 208,
    protein: 25,
    carbohydrates: 0,
    fat: 12,
    saturatedFat: 3,
    unsaturatedFat: 9,
    fiber: 0,
    sodium: 44,
    potassium: 628,
    vitaminD: 526,
    vitaminB12: 4.9,
    cholesterol: 55,
    category: "fatty-fish",
    commonUnit: "g",
    proteinQuality: 95,
    glycemicIndex: 0,
    inflammatoryScore: -25,
    antioxidantScore: 60,
  },

  eggs: {
    calories: 155,
    protein: 13,
    carbohydrates: 1.1,
    fat: 11,
    saturatedFat: 3.3,
    fiber: 0,
    sodium: 124,
    potassium: 138,
    vitaminA: 540,
    vitaminD: 82,
    vitaminB12: 0.9,
    cholesterol: 373,
    category: "complete-protein",
    commonUnit: "large",
    proteinQuality: 100,
    glycemicIndex: 0,
    inflammatoryScore: 0,
  },

  "greek yogurt": {
    calories: 59,
    protein: 10,
    carbohydrates: 3.6,
    fat: 0.4,
    saturatedFat: 0.1,
    sugar: 3.6,
    sodium: 36,
    calcium: 110,
    potassium: 141,
    vitaminB12: 0.8,
    category: "dairy-protein",
    commonUnit: "g",
    proteinQuality: 85,
    glycemicIndex: 35,
    inflammatoryScore: -5,
  },

  // Grains & Complex Carbs
  quinoa: {
    calories: 120,
    protein: 4.4,
    carbohydrates: 22,
    fat: 1.9,
    fiber: 2.8,
    iron: 1.5,
    potassium: 172,
    folate: 42,
    category: "whole-grain",
    commonUnit: "g",
    proteinQuality: 80,
    glycemicIndex: 53,
    inflammatoryScore: -15,
    nutritionDensity: 75,
  },

  "brown rice": {
    calories: 112,
    protein: 2.6,
    carbohydrates: 22,
    fat: 0.9,
    fiber: 1.8,
    iron: 0.4,
    potassium: 43,
    folate: 4,
    category: "whole-grain",
    commonUnit: "g",
    proteinQuality: 60,
    glycemicIndex: 68,
    inflammatoryScore: -5,
  },

  oats: {
    calories: 389,
    protein: 17,
    carbohydrates: 66,
    fat: 7,
    fiber: 10.6,
    iron: 4.7,
    potassium: 429,
    folate: 56,
    category: "whole-grain",
    commonUnit: "g",
    proteinQuality: 65,
    glycemicIndex: 55,
    inflammatoryScore: -20,
    nutritionDensity: 80,
  },

  // Vegetables - Nutrient dense, low calorie
  spinach: {
    calories: 23,
    protein: 2.9,
    carbohydrates: 3.6,
    fat: 0.4,
    fiber: 2.2,
    vitaminA: 2813,
    vitaminC: 28,
    iron: 2.7,
    potassium: 558,
    folate: 194,
    calcium: 99,
    category: "leafy-green",
    commonUnit: "g",
    glycemicIndex: 15,
    inflammatoryScore: -35,
    nutritionDensity: 95,
    antioxidantScore: 90,
  },

  broccoli: {
    calories: 34,
    protein: 2.8,
    carbohydrates: 7,
    fat: 0.4,
    fiber: 2.6,
    vitaminC: 89,
    vitaminA: 623,
    iron: 0.7,
    potassium: 316,
    folate: 63,
    calcium: 47,
    category: "cruciferous",
    commonUnit: "g",
    glycemicIndex: 25,
    inflammatoryScore: -30,
    nutritionDensity: 85,
    antioxidantScore: 85,
  },

  "sweet potato": {
    calories: 86,
    protein: 1.6,
    carbohydrates: 20,
    fat: 0.1,
    fiber: 3,
    sugar: 4.2,
    vitaminA: 14187,
    potassium: 337,
    vitaminC: 2.4,
    calcium: 30,
    category: "starchy-vegetable",
    commonUnit: "g",
    glycemicIndex: 70,
    inflammatoryScore: -15,
    nutritionDensity: 70,
    antioxidantScore: 75,
  },

  tomato: {
    calories: 18,
    protein: 0.9,
    carbohydrates: 3.9,
    fat: 0.2,
    fiber: 1.2,
    sugar: 2.6,
    vitaminC: 14,
    potassium: 237,
    vitaminA: 833,
    folate: 15,
    category: "fruit-vegetable",
    commonUnit: "g",
    glycemicIndex: 30,
    inflammatoryScore: -20,
    antioxidantScore: 70,
  },

  // Fruits
  blueberries: {
    calories: 57,
    protein: 0.7,
    carbohydrates: 14,
    fat: 0.3,
    fiber: 2.4,
    sugar: 10,
    vitaminC: 10,
    potassium: 77,
    vitaminA: 80,
    category: "berry",
    commonUnit: "g",
    glycemicIndex: 53,
    inflammatoryScore: -40,
    antioxidantScore: 95,
    nutritionDensity: 65,
  },

  avocado: {
    calories: 160,
    protein: 2,
    carbohydrates: 9,
    fat: 15,
    unsaturatedFat: 12,
    fiber: 7,
    potassium: 485,
    vitaminC: 10,
    folate: 81,
    vitaminA: 146,
    category: "healthy-fat",
    commonUnit: "g",
    glycemicIndex: 15,
    inflammatoryScore: -25,
    nutritionDensity: 75,
  },

  // Nuts & Seeds
  almonds: {
    calories: 579,
    protein: 21,
    carbohydrates: 22,
    fat: 50,
    unsaturatedFat: 40,
    fiber: 12,
    calcium: 269,
    iron: 3.9,
    potassium: 733,
    vitaminC: 25,
    category: "nuts",
    commonUnit: "g",
    proteinQuality: 70,
    glycemicIndex: 0,
    inflammatoryScore: -15,
    nutritionDensity: 80,
  },

  "chia seeds": {
    calories: 486,
    protein: 17,
    carbohydrates: 42,
    fat: 31,
    unsaturatedFat: 28,
    fiber: 34,
    calcium: 631,
    iron: 7.7,
    potassium: 407,
    category: "seeds",
    commonUnit: "g",
    proteinQuality: 75,
    glycemicIndex: 30,
    inflammatoryScore: -30,
    nutritionDensity: 90,
  },

  // Legumes
  "black beans": {
    calories: 132,
    protein: 8.9,
    carbohydrates: 24,
    fat: 0.5,
    fiber: 8.7,
    iron: 2.1,
    potassium: 355,
    folate: 149,
    category: "legume",
    commonUnit: "g",
    proteinQuality: 70,
    glycemicIndex: 30,
    inflammatoryScore: -20,
    nutritionDensity: 75,
  },

  lentils: {
    calories: 116,
    protein: 9,
    carbohydrates: 20,
    fat: 0.4,
    fiber: 7.9,
    iron: 3.3,
    potassium: 369,
    folate: 181,
    category: "legume",
    commonUnit: "g",
    proteinQuality: 70,
    glycemicIndex: 35,
    inflammatoryScore: -20,
    nutritionDensity: 80,
  },

  // Fats & Oils
  "olive oil": {
    calories: 884,
    protein: 0,
    carbohydrates: 0,
    fat: 100,
    unsaturatedFat: 85,
    saturatedFat: 15,
    category: "healthy-oil",
    commonUnit: "ml",
    density: 0.92,
    glycemicIndex: 0,
    inflammatoryScore: -20,
    antioxidantScore: 50,
  },

  "coconut oil": {
    calories: 862,
    protein: 0,
    carbohydrates: 0,
    fat: 100,
    saturatedFat: 87,
    category: "saturated-oil",
    commonUnit: "ml",
    density: 0.92,
    glycemicIndex: 0,
    inflammatoryScore: 10,
  },

  // Processed foods (generally less healthy)
  "white bread": {
    calories: 265,
    protein: 9,
    carbohydrates: 49,
    fat: 3.2,
    fiber: 2.7,
    sodium: 477,
    iron: 3.6,
    category: "refined-grain",
    commonUnit: "g",
    proteinQuality: 55,
    glycemicIndex: 75,
    inflammatoryScore: 15,
    nutritionDensity: 30,
  },

  sugar: {
    calories: 387,
    protein: 0,
    carbohydrates: 100,
    fat: 0,
    sugar: 100,
    category: "added-sugar",
    commonUnit: "g",
    glycemicIndex: 100,
    inflammatoryScore: 25,
  },
};

/**
 * Calculate comprehensive nutritional profile for a recipe
 */
export async function calculateDetailedNutrition(
  ingredients: Ingredient[],
  servings: number = 1,
  useExternalAPI: boolean = false
): Promise<DetailedNutritionProfile> {
  console.log(
    "🧮 Calculating detailed nutrition for",
    ingredients.length,
    "ingredients"
  );

  // Initialize totals
  const totals: Partial<DetailedNutritionProfile> = {
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    saturatedFat: 0,
    unsaturatedFat: 0,
    sodium: 0,
    potassium: 0,
    calcium: 0,
    iron: 0,
    vitaminC: 0,
    vitaminA: 0,
    vitaminD: 0,
    vitaminB12: 0,
    folate: 0,
    cholesterol: 0,
  };

  let totalWeight = 0;
  let overallGlycemicLoad = 0;
  let inflammatoryContributions = 0;
  let nutritionDensityScore = 0;
  let proteinQualityScore = 0;
  let antioxidantContributions = 0;

  // Process each ingredient
  for (const ingredient of ingredients) {
    const nutritionData = await getIngredientNutrition(
      ingredient,
      useExternalAPI
    );

    if (nutritionData) {
      const weight = convertIngredientToGrams(ingredient);
      const factor = weight / 100; // Database values are per 100g

      totalWeight += weight;

      // Add macronutrients
      totals.calories =
        (totals.calories || 0) + (nutritionData.calories || 0) * factor;
      totals.protein =
        (totals.protein || 0) + (nutritionData.protein || 0) * factor;
      totals.carbohydrates =
        (totals.carbohydrates || 0) +
        (nutritionData.carbohydrates || 0) * factor;
      totals.fat = (totals.fat || 0) + (nutritionData.fat || 0) * factor;

      // Add detailed nutrients
      totals.fiber = (totals.fiber || 0) + (nutritionData.fiber || 0) * factor;
      totals.sugar = (totals.sugar || 0) + (nutritionData.sugar || 0) * factor;
      totals.saturatedFat =
        (totals.saturatedFat || 0) + (nutritionData.saturatedFat || 0) * factor;
      totals.unsaturatedFat =
        (totals.unsaturatedFat || 0) +
        (nutritionData.unsaturatedFat || 0) * factor;

      // Add micronutrients
      totals.sodium =
        (totals.sodium || 0) + (nutritionData.sodium || 0) * factor;
      totals.potassium =
        (totals.potassium || 0) + (nutritionData.potassium || 0) * factor;
      totals.calcium =
        (totals.calcium || 0) + (nutritionData.calcium || 0) * factor;
      totals.iron = (totals.iron || 0) + (nutritionData.iron || 0) * factor;
      totals.vitaminC =
        (totals.vitaminC || 0) + (nutritionData.vitaminC || 0) * factor;
      totals.vitaminA =
        (totals.vitaminA || 0) + (nutritionData.vitaminA || 0) * factor;
      totals.vitaminD =
        (totals.vitaminD || 0) + (nutritionData.vitaminD || 0) * factor;
      totals.vitaminB12 =
        (totals.vitaminB12 || 0) + (nutritionData.vitaminB12 || 0) * factor;
      totals.folate =
        (totals.folate || 0) + (nutritionData.folate || 0) * factor;
      totals.cholesterol =
        (totals.cholesterol || 0) + (nutritionData.cholesterol || 0) * factor;

      // Calculate weighted quality scores
      if (nutritionData.glycemicIndex) {
        const carbContent = (nutritionData.carbohydrates || 0) * factor;
        overallGlycemicLoad +=
          (nutritionData.glycemicIndex * carbContent) / 100;
      }

      if (nutritionData.inflammatoryScore) {
        inflammatoryContributions += nutritionData.inflammatoryScore * factor;
      }

      if (nutritionData.nutritionDensity) {
        nutritionDensityScore += nutritionData.nutritionDensity * factor;
      }

      if (nutritionData.proteinQuality) {
        const proteinContent = (nutritionData.protein || 0) * factor;
        proteinQualityScore += nutritionData.proteinQuality * proteinContent;
      }

      if (nutritionData.antioxidantScore) {
        antioxidantContributions += nutritionData.antioxidantScore * factor;
      }
    }
  }

  //   // Calculate per-serving values
  //   const perServing = Object.keys(totals).reduce((acc, key) => {
  //     acc[key as keyof DetailedNutritionProfile] =
  //       Math.round(
  //         ((totals[key as keyof DetailedNutritionProfile] || 0) / servings) * 100
  //       ) / 100;
  //     return acc;
  //   }, {} as Partial<DetailedNutritionProfile>);

  // Calculate derived metrics
  const totalCarbs = totals.carbohydrates || 0;
  const averageGlycemicIndex =
    totalCarbs > 0 ? Math.round((overallGlycemicLoad / totalCarbs) * 100) : 0;

  const averageInflammatoryScore =
    totalWeight > 0
      ? Math.round((inflammatoryContributions / totalWeight) * 100)
      : 0;

  const averageNutritionDensity =
    totalWeight > 0 ? Math.round(nutritionDensityScore / totalWeight) : 50;

  const totalProtein = totals.protein || 0;
  const averageProteinQuality =
    totalProtein > 0 ? Math.round(proteinQualityScore / totalProtein) : 50;

  const averageAntioxidantScore =
    totalWeight > 0 ? Math.round(antioxidantContributions / totalWeight) : 30;

  return {
    // Basic macros
    calories: Math.round((totals.calories || 0) / servings),
    protein: Math.round(((totals.protein || 0) / servings) * 100) / 100,
    carbohydrates:
      Math.round(((totals.carbohydrates || 0) / servings) * 100) / 100,
    fat: Math.round(((totals.fat || 0) / servings) * 100) / 100,

    // Extended macros
    fiber: Math.round(((totals.fiber || 0) / servings) * 100) / 100,
    sugar: Math.round(((totals.sugar || 0) / servings) * 100) / 100,
    saturatedFat:
      Math.round(((totals.saturatedFat || 0) / servings) * 100) / 100,
    unsaturatedFat:
      Math.round(((totals.unsaturatedFat || 0) / servings) * 100) / 100,

    // Micronutrients
    sodium: Math.round((totals.sodium || 0) / servings),
    potassium: Math.round((totals.potassium || 0) / servings),
    calcium: Math.round((totals.calcium || 0) / servings),
    iron: Math.round(((totals.iron || 0) / servings) * 100) / 100,
    vitaminC: Math.round(((totals.vitaminC || 0) / servings) * 100) / 100,
    vitaminA: Math.round((totals.vitaminA || 0) / servings),
    vitaminD: Math.round((totals.vitaminD || 0) / servings),
    vitaminB12: Math.round(((totals.vitaminB12 || 0) / servings) * 100) / 100,
    folate: Math.round((totals.folate || 0) / servings),
    cholesterol: Math.round((totals.cholesterol || 0) / servings),

    // Calculated metrics
    glycemicIndex: Math.max(0, Math.min(100, averageGlycemicIndex)),
    inflammatoryScore: Math.max(-100, Math.min(100, averageInflammatoryScore)),
    nutritionDensity: Math.max(0, Math.min(100, averageNutritionDensity)),
    proteinQuality: Math.max(0, Math.min(100, averageProteinQuality)),
    antioxidantScore: Math.max(0, Math.min(100, averageAntioxidantScore)),
  };
}

/**
 * Get nutrition data for a single ingredient
 */
async function getIngredientNutrition(
  ingredient: Ingredient,
  useExternalAPI: boolean = false
): Promise<Partial<DetailedNutritionProfile> | null> {
  const normalizedName = normalizeIngredientName(ingredient.name);

  // Try exact match first
  const exactMatch = COMPREHENSIVE_NUTRITION_DB[normalizedName];
  if (exactMatch) {
    return exactMatch;
  }

  // Try partial matches
  for (const [key, value] of Object.entries(COMPREHENSIVE_NUTRITION_DB)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return value;
    }
  }

  // TODO: If external API is enabled, call nutrition API here
  if (useExternalAPI) {
    // Future: Integrate with Edamam, USDA, or Spoonacular APIs
    console.log(`🔍 Would query external API for: ${ingredient.name}`);
  }

  // Return null if no match found
  console.warn(`⚠️ No nutrition data found for ingredient: ${ingredient.name}`);
  return null;
}

/**
 * Convert ingredient to grams for calculation
 */
function convertIngredientToGrams(ingredient: Ingredient): number {
  const { amount, unit, name } = ingredient;
  const normalizedUnit = unit.toLowerCase().trim();
  const normalizedName = normalizeIngredientName(name);

  // If already in grams
  if (["g", "gram", "grams"].includes(normalizedUnit)) {
    return amount;
  }

  // Get density for volume conversions
  const nutritionData = COMPREHENSIVE_NUTRITION_DB[normalizedName];
  const density = nutritionData?.density || 1; // Default to 1g/ml

  // Convert volume to grams
  const volumeToMl: Record<string, number> = {
    ml: 1,
    milliliter: 1,
    milliliters: 1,
    l: 1000,
    liter: 1000,
    liters: 1000,
    cup: 236.6,
    cups: 236.6,
    tbsp: 14.8,
    tablespoon: 14.8,
    tablespoons: 14.8,
    tsp: 4.9,
    teaspoon: 4.9,
    teaspoons: 4.9,
    "fl oz": 29.6,
    "fluid ounce": 29.6,
    "fluid ounces": 29.6,
  };

  if (volumeToMl[normalizedUnit]) {
    return amount * volumeToMl[normalizedUnit] * density;
  }

  // Convert weight to grams
  const weightToGrams: Record<string, number> = {
    kg: 1000,
    kilogram: 1000,
    kilograms: 1000,
    lb: 453.6,
    pound: 453.6,
    pounds: 453.6,
    oz: 28.35,
    ounce: 28.35,
    ounces: 28.35,
  };

  if (weightToGrams[normalizedUnit]) {
    return amount * weightToGrams[normalizedUnit];
  }

  // Common food-specific conversions
  const foodSpecificConversions: Record<string, Record<string, number>> = {
    eggs: { large: 50, medium: 44, small: 38, piece: 50, pieces: 50 },
    banana: { medium: 118, large: 136, small: 90, piece: 118 },
    apple: { medium: 182, large: 223, small: 149, piece: 182 },
  };

  for (const [food, conversions] of Object.entries(foodSpecificConversions)) {
    if (normalizedName.includes(food) && conversions[normalizedUnit]) {
      return amount * conversions[normalizedUnit];
    }
  }

  // Default estimation
  console.warn(
    `⚠️ Unknown unit "${unit}" for ingredient "${name}", using estimation`
  );
  return amount * 50; // Rough estimate
}

/**
 * Normalize ingredient name for lookup
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(
      /\b(fresh|dried|chopped|sliced|diced|minced|grated|cooked|raw|organic)\b/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compare recipe nutrition against user's macro targets
 */
export function compareAgainstTargets(
  recipeNutrition: DetailedNutritionProfile,
  userTargets: MacroTargets,
  servingsConsumed: number = 1
): {
  comparison: Record<
    string,
    {
      actual: number;
      target: number;
      percentage: number;
      status: "under" | "over" | "good";
    }
  >;
  recommendations: string[];
} {
  const actualCalories = recipeNutrition.calories * servingsConsumed;
  const actualProtein = recipeNutrition.protein * servingsConsumed;
  const actualCarbs = recipeNutrition.carbohydrates * servingsConsumed;
  const actualFat = recipeNutrition.fat * servingsConsumed;

  const comparison = {
    calories: {
      actual: actualCalories,
      target: userTargets.dailyCalories,
      percentage: Math.round(
        (actualCalories / userTargets.dailyCalories) * 100
      ),
      status: getComparisonStatus(
        actualCalories,
        userTargets.dailyCalories,
        0.1
      ),
    },
    protein: {
      actual: actualProtein,
      target: userTargets.proteinGrams,
      percentage: Math.round((actualProtein / userTargets.proteinGrams) * 100),
      status: getComparisonStatus(
        actualProtein,
        userTargets.proteinGrams,
        0.15
      ),
    },
    carbs: {
      actual: actualCarbs,
      target: userTargets.carbsGrams,
      percentage: Math.round((actualCarbs / userTargets.carbsGrams) * 100),
      status: getComparisonStatus(actualCarbs, userTargets.carbsGrams, 0.2),
    },
    fat: {
      actual: actualFat,
      target: userTargets.fatGrams,
      percentage: Math.round((actualFat / userTargets.fatGrams) * 100),
      status: getComparisonStatus(actualFat, userTargets.fatGrams, 0.2),
    },
  };

  const recommendations: string[] = [];

  // Generate recommendations based on comparison
  if (comparison.calories.status === "over") {
    recommendations.push(
      "Consider reducing portion size or substituting high-calorie ingredients"
    );
  }

  if (comparison.protein.status === "under") {
    recommendations.push(
      "Add more protein sources like lean meat, fish, eggs, or legumes"
    );
  }

  if (recipeNutrition.fiber < 10) {
    recommendations.push(
      "Increase fiber by adding vegetables, fruits, or whole grains"
    );
  }

  if (recipeNutrition.sodium > 1000) {
    recommendations.push(
      "Reduce sodium by using herbs and spices instead of salt"
    );
  }

  if (recipeNutrition.nutritionDensity < 60) {
    recommendations.push(
      "Boost nutrition density with more colorful vegetables and whole foods"
    );
  }

  return { comparison, recommendations };
}

/**
 * Get comparison status
 */
function getComparisonStatus(
  actual: number,
  target: number,
  tolerance: number
): "under" | "over" | "good" {
  const ratio = actual / target;

  if (ratio < 1 - tolerance) return "under";
  if (ratio > 1 + tolerance) return "over";
  return "good";
}

/**
 * Generate nutrition recommendations for recipe improvement
 */
export function generateNutritionRecommendations(
  nutrition: DetailedNutritionProfile
): string[] {
  const recommendations: string[] = [];

  // Protein recommendations
  if (nutrition.protein < 15) {
    recommendations.push(
      "Increase protein content with lean meats, fish, eggs, or plant proteins"
    );
  }

  // Fiber recommendations
  if (nutrition.fiber < 5) {
    recommendations.push(
      "Add more fiber with vegetables, fruits, beans, or whole grains"
    );
  }

  // Micronutrient recommendations
  if (nutrition.iron < 2) {
    recommendations.push(
      "Boost iron with leafy greens, lean meats, or fortified cereals"
    );
  }

  if (nutrition.calcium < 100) {
    recommendations.push(
      "Increase calcium with dairy products, leafy greens, or fortified alternatives"
    );
  }

  if (nutrition.vitaminC < 10) {
    recommendations.push(
      "Add vitamin C with citrus fruits, berries, or colorful vegetables"
    );
  }

  // Health score recommendations
  if (nutrition.antioxidantScore < 50) {
    recommendations.push(
      "Include more colorful fruits and vegetables for antioxidants"
    );
  }

  if (nutrition.inflammatoryScore > 0) {
    recommendations.push(
      "Reduce inflammation with omega-3 rich foods and anti-inflammatory spices"
    );
  }

  // Sodium recommendations
  if (nutrition.sodium > 800) {
    recommendations.push(
      "Reduce sodium by using herbs, spices, and fresh ingredients instead of processed foods"
    );
  }

  return recommendations;
}

/**
 * Calculate recipe scaling for different serving sizes
 */
export function scaleRecipeNutrition(
  originalNutrition: DetailedNutritionProfile,
  originalServings: number,
  newServings: number
): DetailedNutritionProfile {
  const scaleFactor = newServings / originalServings;

  return Object.keys(originalNutrition).reduce((scaled, key) => {
    const value = originalNutrition[key as keyof DetailedNutritionProfile];
    scaled[key as keyof DetailedNutritionProfile] =
      Math.round(value * scaleFactor * 100) / 100;
    return scaled;
  }, {} as DetailedNutritionProfile);
}
