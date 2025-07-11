/**
 * AI-Powered Recipe Enhancement Service
 *
 * Provides intelligent recipe processing including:
 * - Recipe quality scoring and validation
 * - Automatic categorization and tagging
 * - Ingredient standardization
 * - Nutrition analysis enhancement
 * - Recipe improvement suggestions
 */

import { RecipeFormData, Ingredient } from "@/types/recipe";

// Quality scoring interfaces
export interface RecipeQualityScore {
  overall: number; // 0-100
  completeness: number; // 0-100
  clarity: number; // 0-100
  nutrition: number; // 0-100
  practicality: number; // 0-100
  suggestions: string[];
}

// Enhancement result interface
export interface RecipeEnhancement {
  enhanced: RecipeFormData;
  qualityScore: RecipeQualityScore;
  autoCategories: string[];
  autoTags: string[];
  nutritionAnalysis: NutritionAnalysis;
  improvements: RecipeImprovement[];
}

// Nutrition analysis interface
export interface NutritionAnalysis {
  estimatedCalories: number;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  micronutrients: {
    sodium: number;
    sugar: number;
    vitamins: string[];
  };
  healthScore: number; // 0-100
  dietaryFlags: string[]; // e.g., "vegetarian", "gluten-free", "high-protein"
}

// Recipe improvement suggestions
export interface RecipeImprovement {
  type: "ingredient" | "instruction" | "nutrition" | "presentation";
  severity: "low" | "medium" | "high";
  suggestion: string;
  originalValue?: string;
  suggestedValue?: string;
}

// Ingredient standardization
interface StandardizedIngredient extends Ingredient {
  standardizedName: string;
  category: string;
  nutritionPer100g?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

// Common ingredient database for standardization
const INGREDIENT_DATABASE: Record<
  string,
  StandardizedIngredient["nutritionPer100g"] & { category: string }
> = {
  // Proteins
  "chicken breast": {
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    category: "protein",
  },
  "ground beef": {
    calories: 250,
    protein: 26,
    carbs: 0,
    fat: 15,
    category: "protein",
  },
  salmon: {
    calories: 208,
    protein: 25,
    carbs: 0,
    fat: 12,
    category: "protein",
  },
  eggs: {
    calories: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
    category: "protein",
  },
  tofu: { calories: 76, protein: 8, carbs: 1.9, fat: 4.8, category: "protein" },

  // Grains & Carbs
  rice: { calories: 130, protein: 2.7, carbs: 28, fat: 0.3, category: "grain" },
  quinoa: {
    calories: 120,
    protein: 4.4,
    carbs: 22,
    fat: 1.9,
    category: "grain",
  },
  pasta: { calories: 131, protein: 5, carbs: 25, fat: 1.1, category: "grain" },
  bread: { calories: 265, protein: 9, carbs: 49, fat: 3.2, category: "grain" },
  oats: { calories: 389, protein: 17, carbs: 66, fat: 7, category: "grain" },

  // Vegetables
  broccoli: {
    calories: 34,
    protein: 2.8,
    carbs: 7,
    fat: 0.4,
    category: "vegetable",
  },
  spinach: {
    calories: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
    category: "vegetable",
  },
  tomato: {
    calories: 18,
    protein: 0.9,
    carbs: 3.9,
    fat: 0.2,
    category: "vegetable",
  },
  onion: {
    calories: 40,
    protein: 1.1,
    carbs: 9.3,
    fat: 0.1,
    category: "vegetable",
  },
  garlic: {
    calories: 149,
    protein: 6.4,
    carbs: 33,
    fat: 0.5,
    category: "vegetable",
  },

  // Fruits
  apple: { calories: 52, protein: 0.3, carbs: 14, fat: 0.2, category: "fruit" },
  banana: {
    calories: 89,
    protein: 1.1,
    carbs: 23,
    fat: 0.3,
    category: "fruit",
  },
  lemon: { calories: 29, protein: 1.1, carbs: 9, fat: 0.3, category: "fruit" },

  // Dairy & Fats
  milk: { calories: 42, protein: 3.4, carbs: 5, fat: 1, category: "dairy" },
  cheese: {
    calories: 402,
    protein: 25,
    carbs: 1.3,
    fat: 33,
    category: "dairy",
  },
  butter: { calories: 717, protein: 0.9, carbs: 0.1, fat: 81, category: "fat" },
  "olive oil": {
    calories: 884,
    protein: 0,
    carbs: 0,
    fat: 100,
    category: "fat",
  },
};

// Unit standardization mappings
const UNIT_STANDARDIZATION: Record<
  string,
  { standard: string; factor: number }
> = {
  // Volume
  cups: { standard: "ml", factor: 236.6 },
  cup: { standard: "ml", factor: 236.6 },
  tbsp: { standard: "ml", factor: 14.8 },
  tablespoon: { standard: "ml", factor: 14.8 },
  tablespoons: { standard: "ml", factor: 14.8 },
  tsp: { standard: "ml", factor: 4.9 },
  teaspoon: { standard: "ml", factor: 4.9 },
  teaspoons: { standard: "ml", factor: 4.9 },
  "fl oz": { standard: "ml", factor: 29.6 },
  pint: { standard: "ml", factor: 473 },
  quart: { standard: "ml", factor: 946 },
  gallon: { standard: "ml", factor: 3785 },

  // Weight
  lbs: { standard: "g", factor: 453.6 },
  lb: { standard: "g", factor: 453.6 },
  pounds: { standard: "g", factor: 453.6 },
  oz: { standard: "g", factor: 28.3 },
  ounces: { standard: "g", factor: 28.3 },
  kg: { standard: "g", factor: 1000 },
  kilogram: { standard: "g", factor: 1000 },
  kilograms: { standard: "g", factor: 1000 },
};

/**
 * Main recipe enhancement function
 */
export async function enhanceRecipe(
  recipe: RecipeFormData
): Promise<RecipeEnhancement> {
  try {
    console.log("🔧 Starting recipe enhancement for:", recipe.title);

    // Start with the original recipe
    const enhanced = { ...recipe };

    // 1. Standardize ingredients
    const standardizedIngredients = standardizeIngredients(recipe.ingredients);
    enhanced.ingredients = standardizedIngredients;

    // 2. Analyze and enhance nutrition
    const nutritionAnalysis = analyzeNutrition(
      standardizedIngredients,
      recipe.servings
    );

    // 3. Auto-generate categories and tags
    const autoCategories = await generateAutoCategories(recipe);
    const autoTags = await generateAutoTags(recipe, nutritionAnalysis);

    // 4. Calculate quality score
    const qualityScore = calculateQualityScore(recipe, nutritionAnalysis);

    // 5. Generate improvement suggestions
    const improvements = generateImprovements(
      recipe,
      qualityScore,
      nutritionAnalysis
    );

    // 6. Apply automatic enhancements
    enhanced.tags = [...(recipe.tags || []), ...autoTags];
    enhanced.calories = Math.round(nutritionAnalysis.estimatedCalories);
    enhanced.protein = Math.round(nutritionAnalysis.macros.protein);
    enhanced.carbs = Math.round(nutritionAnalysis.macros.carbs);
    enhanced.fat = Math.round(nutritionAnalysis.macros.fat);
    enhanced.fiber = Math.round(nutritionAnalysis.macros.fiber);
    enhanced.sodium = Math.round(nutritionAnalysis.micronutrients.sodium);

    // 7. Enhance title and description if needed
    if (qualityScore.completeness < 70) {
      enhanced.title = enhanceTitle(recipe.title);
      enhanced.description = enhanceDescription(
        recipe.description,
        nutritionAnalysis
      );
    }

    console.log(
      "✅ Recipe enhancement completed with quality score:",
      qualityScore.overall
    );

    return {
      enhanced,
      qualityScore,
      autoCategories,
      autoTags,
      nutritionAnalysis,
      improvements,
    };
  } catch (error) {
    console.error("❌ Recipe enhancement failed:", error);
    throw new Error("Failed to enhance recipe. Please try again.");
  }
}

/**
 * Standardize ingredient names and units
 */
function standardizeIngredients(ingredients: Ingredient[]): Ingredient[] {
  return ingredients.map((ingredient) => {
    // let standardizedName = ingredient.name.toLowerCase().trim();
    let standardizedUnit = ingredient.unit.toLowerCase().trim();
    let standardizedAmount = ingredient.amount;

    // Remove extra words and normalize name
    // standardizedName = standardizedName
    //   .replace(/\b(fresh|dried|chopped|sliced|diced|minced|grated)\b/g, "")
    //   .replace(/\s+/g, " ")
    //   .trim();

    // Standardize units
    const unitMapping = UNIT_STANDARDIZATION[standardizedUnit];
    if (unitMapping) {
      standardizedAmount =
        Math.round(standardizedAmount * unitMapping.factor * 100) / 100;
      standardizedUnit = unitMapping.standard;
    }

    return {
      name: ingredient.name, // Keep original name for display
      amount: standardizedAmount,
      unit: standardizedUnit,
    };
  });
}

/**
 * Analyze nutrition content of recipe
 */
function analyzeNutrition(
  ingredients: Ingredient[],
  servings: number
): NutritionAnalysis {
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalSodium = 0;

  const dietaryFlags: string[] = [];
  const vitamins: string[] = [];

  // Calculate nutrition from ingredients
  ingredients.forEach((ingredient) => {
    const standardName = ingredient.name.toLowerCase().trim();
    const nutritionData = findIngredientNutrition(standardName);

    if (nutritionData) {
      // Convert amount to grams for calculation
      const amountInGrams = convertToGrams(ingredient.amount, ingredient.unit);
      const factor = amountInGrams / 100; // Nutrition data is per 100g

      totalCalories += nutritionData.calories * factor;
      totalProtein += nutritionData.protein * factor;
      totalCarbs += nutritionData.carbs * factor;
      totalFat += nutritionData.fat * factor;
    }
  });

  // Estimate fiber (rough calculation)
  totalFiber = Math.max(1, totalCarbs * 0.15);

  // Estimate sodium (rough calculation - varies greatly by recipe type)
  totalSodium = Math.max(200, totalCalories * 0.5);

  // Determine dietary flags
  const hasAnimalProducts = ingredients.some((ing) =>
    isAnimalProduct(ing.name.toLowerCase())
  );

  if (!hasAnimalProducts) {
    dietaryFlags.push("vegetarian");

    const hasDairy = ingredients.some((ing) =>
      isDairyProduct(ing.name.toLowerCase())
    );

    if (!hasDairy) {
      dietaryFlags.push("vegan");
    }
  }

  // Add other dietary flags
  if (totalProtein > (totalCalories * 0.25) / 4) {
    dietaryFlags.push("high-protein");
  }

  if (totalCarbs < (totalCalories * 0.2) / 4) {
    dietaryFlags.push("low-carb");
  }

  if (totalFat > (totalCalories * 0.6) / 9) {
    dietaryFlags.push("high-fat");
  }

  // Calculate health score
  const healthScore = calculateHealthScore(
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    totalFiber,
    totalSodium
  );

  return {
    estimatedCalories: Math.round(totalCalories / servings),
    macros: {
      protein: Math.round(totalProtein / servings),
      carbs: Math.round(totalCarbs / servings),
      fat: Math.round(totalFat / servings),
      fiber: Math.round(totalFiber / servings),
    },
    micronutrients: {
      sodium: Math.round(totalSodium / servings),
      sugar: Math.round((totalCarbs * 0.3) / servings), // Rough estimate
      vitamins,
    },
    healthScore,
    dietaryFlags,
  };
}

/**
 * Find nutrition data for an ingredient
 */
function findIngredientNutrition(
  ingredientName: string
): (typeof INGREDIENT_DATABASE)[string] | null {
  // Try exact match first
  if (INGREDIENT_DATABASE[ingredientName]) {
    return INGREDIENT_DATABASE[ingredientName];
  }

  // Try partial matches
  for (const [key, value] of Object.entries(INGREDIENT_DATABASE)) {
    if (ingredientName.includes(key) || key.includes(ingredientName)) {
      return value;
    }
  }

  return null;
}

/**
 * Convert ingredient amount to grams for nutrition calculation
 */
function convertToGrams(amount: number, unit: string): number {
  const standardUnit = unit.toLowerCase().trim();

  // If already in grams
  if (["g", "gram", "grams"].includes(standardUnit)) {
    return amount;
  }

  // Convert from ml to grams (approximate for common ingredients)
  if (["ml", "milliliter", "milliliters"].includes(standardUnit)) {
    return amount; // 1ml ≈ 1g for most cooking ingredients
  }

  // Default estimation for unknown units
  return amount * 50; // Rough estimate
}

/**
 * Check if ingredient is an animal product
 */
function isAnimalProduct(name: string): boolean {
  const animalProducts = [
    "chicken",
    "beef",
    "pork",
    "turkey",
    "fish",
    "salmon",
    "tuna",
    "shrimp",
    "meat",
    "bacon",
    "ham",
    "sausage",
    "egg",
    "eggs",
    "milk",
    "butter",
    "cream",
    "cheese",
    "yogurt",
    "honey",
  ];

  return animalProducts.some((product) => name.includes(product));
}

/**
 * Check if ingredient is a dairy product
 */
function isDairyProduct(name: string): boolean {
  const dairyProducts = ["milk", "butter", "cream", "cheese", "yogurt"];
  return dairyProducts.some((product) => name.includes(product));
}

/**
 * Calculate overall health score
 */
function calculateHealthScore(
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number,
  sodium: number
): number {
  let score = 50; // Start with neutral score

  // Protein bonus (higher protein = healthier)
  const proteinRatio = (protein * 4) / calories;
  if (proteinRatio > 0.25) score += 15;
  else if (proteinRatio > 0.15) score += 10;

  // Fiber bonus
  if (fiber > 10) score += 15;
  else if (fiber > 5) score += 10;

  // Sodium penalty
  if (sodium > 2000) score -= 20;
  else if (sodium > 1500) score -= 10;

  // Calorie density consideration
  if (calories > 600) score -= 10;
  else if (calories < 200) score -= 5;

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate automatic categories based on recipe content
 */
async function generateAutoCategories(
  recipe: RecipeFormData
): Promise<string[]> {
  const categories: string[] = [];
  const ingredients = recipe.ingredients
    .map((ing) => ing.name.toLowerCase())
    .join(" ");
  const title = recipe.title.toLowerCase();
  const description = recipe.description?.toLowerCase() || "";
  const content = `${title} ${description} ${ingredients}`;

  // Meal type detection
  if (
    content.includes("breakfast") ||
    content.includes("morning") ||
    content.includes("cereal") ||
    content.includes("pancake") ||
    content.includes("waffle") ||
    content.includes("oatmeal")
  ) {
    categories.push("breakfast");
  }

  if (
    content.includes("lunch") ||
    content.includes("sandwich") ||
    content.includes("salad") ||
    content.includes("wrap")
  ) {
    categories.push("lunch");
  }

  if (
    content.includes("dinner") ||
    content.includes("main") ||
    content.includes("entree") ||
    content.includes("steak") ||
    content.includes("pasta") ||
    content.includes("rice")
  ) {
    categories.push("dinner");
  }

  if (
    content.includes("dessert") ||
    content.includes("cake") ||
    content.includes("cookie") ||
    content.includes("pie") ||
    content.includes("sweet") ||
    content.includes("chocolate")
  ) {
    categories.push("dessert");
  }

  if (
    content.includes("snack") ||
    content.includes("appetizer") ||
    content.includes("dip") ||
    content.includes("chip")
  ) {
    categories.push("snack");
  }

  // Cuisine type detection
  if (
    content.includes("italian") ||
    content.includes("pasta") ||
    content.includes("pizza") ||
    content.includes("basil") ||
    content.includes("parmesan")
  ) {
    categories.push("italian");
  }

  if (
    content.includes("mexican") ||
    content.includes("taco") ||
    content.includes("burrito") ||
    content.includes("salsa") ||
    content.includes("cilantro") ||
    content.includes("lime")
  ) {
    categories.push("mexican");
  }

  if (
    content.includes("asian") ||
    content.includes("soy sauce") ||
    content.includes("ginger") ||
    content.includes("sesame") ||
    content.includes("rice") ||
    content.includes("noodle")
  ) {
    categories.push("asian");
  }

  return categories;
}

/**
 * Generate automatic tags based on recipe analysis
 */
async function generateAutoTags(
  recipe: RecipeFormData,
  nutrition: NutritionAnalysis
): Promise<string[]> {
  const tags: string[] = [];

  // Add dietary flags as tags
  tags.push(...nutrition.dietaryFlags);

  // Time-based tags
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  if (totalTime <= 15) tags.push("quick");
  if (totalTime <= 30) tags.push("easy");
  if (totalTime >= 120) tags.push("slow-cook");

  // Difficulty-based tags
  if (recipe.difficulty === "easy") tags.push("beginner-friendly");
  if (recipe.difficulty === "hard") tags.push("advanced");

  // Nutrition-based tags
  if (nutrition.estimatedCalories < 300) tags.push("light");
  if (nutrition.estimatedCalories > 600) tags.push("hearty");
  if (nutrition.healthScore > 80) tags.push("healthy");
  if (nutrition.macros.protein > 25) tags.push("protein-rich");
  if (nutrition.macros.fiber > 10) tags.push("high-fiber");

  // Ingredient-based tags
  const ingredients = recipe.ingredients
    .map((ing) => ing.name.toLowerCase())
    .join(" ");
  if (ingredients.includes("chicken")) tags.push("chicken");
  if (ingredients.includes("beef")) tags.push("beef");
  if (ingredients.includes("fish") || ingredients.includes("salmon"))
    tags.push("seafood");
  if (ingredients.includes("cheese")) tags.push("cheesy");
  if (ingredients.includes("spicy") || ingredients.includes("pepper"))
    tags.push("spicy");

  // Remove duplicates and return
  return [...new Set(tags)];
}

/**
 * Calculate comprehensive quality score
 */
function calculateQualityScore(
  recipe: RecipeFormData,
  nutrition: NutritionAnalysis
): RecipeQualityScore {
  const suggestions: string[] = [];

  // Completeness score (0-100)
  let completeness = 0;
  if (recipe.title?.length >= 3) completeness += 15;
  if (recipe.description?.length || 0 >= 20) completeness += 15;
  if (recipe.ingredients?.length >= 2) completeness += 20;
  if (recipe.instructions?.length >= 2) completeness += 20;
  if (recipe.prepTime && recipe.cookTime) completeness += 10;
  if (recipe.servings >= 1) completeness += 10;
  if (recipe.difficulty) completeness += 5;
  if (recipe.imageUrl) completeness += 5;

  // Clarity score (0-100)
  let clarity = 50; // Base score

  // Check instruction clarity
  const avgInstructionLength =
    recipe.instructions.reduce((sum, inst) => sum + inst.length, 0) /
    recipe.instructions.length;
  if (avgInstructionLength > 50) clarity += 20;
  else if (avgInstructionLength < 20) clarity -= 10;

  // Check ingredient specificity
  const hasVagueIngredients = recipe.ingredients.some(
    (ing) => ing.name.length < 3 || !ing.unit || ing.amount <= 0
  );
  if (hasVagueIngredients) {
    clarity -= 20;
    suggestions.push(
      "Some ingredients need more specific amounts or descriptions"
    );
  }

  // Nutrition score (0-100)
  const nutritionScore = nutrition.healthScore;

  // Practicality score (0-100)
  let practicality = 70; // Base score

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  if (totalTime > 180) {
    practicality -= 20;
    suggestions.push(
      "Consider breaking down long cooking times into more manageable steps"
    );
  }

  if (recipe.ingredients.length > 20) {
    practicality -= 15;
    suggestions.push(
      "Recipe has many ingredients - consider if some can be simplified or made optional"
    );
  }

  if (recipe.servings > 12) {
    practicality -= 10;
    suggestions.push("Large serving sizes might be difficult for home cooking");
  }

  // Overall score
  const overall = Math.round(
    (completeness + clarity + nutritionScore + practicality) / 4
  );

  // Add general suggestions based on scores
  if (completeness < 70) {
    suggestions.push(
      "Add more recipe details like prep time, description, or cooking difficulty"
    );
  }

  if (clarity < 60) {
    suggestions.push("Make instructions more detailed and specific");
  }

  if (nutritionScore < 50) {
    suggestions.push(
      "Consider adding more nutritious ingredients or reducing sodium/sugar"
    );
  }

  return {
    overall,
    completeness,
    clarity,
    nutrition: nutritionScore,
    practicality,
    suggestions,
  };
}

/**
 * Generate specific improvement suggestions
 */
function generateImprovements(
  recipe: RecipeFormData,
  quality: RecipeQualityScore,
  nutrition: NutritionAnalysis
): RecipeImprovement[] {
  const improvements: RecipeImprovement[] = [];

  // Ingredient improvements
  recipe.ingredients.forEach((ingredient, index) => {
    if (!ingredient.unit || ingredient.amount <= 0) {
      improvements.push({
        type: "ingredient",
        severity: "high",
        suggestion: `Ingredient ${index + 1} needs specific amount and unit`,
        originalValue: `${ingredient.name}`,
        suggestedValue: `Add specific amount and unit (e.g., "2 cups" or "200g")`,
      });
    }

    if (ingredient.name.length < 3) {
      improvements.push({
        type: "ingredient",
        severity: "medium",
        suggestion: `Ingredient name "${ingredient.name}" is too short`,
        originalValue: ingredient.name,
        suggestedValue: "Use more descriptive ingredient names",
      });
    }
  });

  // Instruction improvements
  recipe.instructions.forEach((instruction, index) => {
    if (instruction.length < 10) {
      improvements.push({
        type: "instruction",
        severity: "medium",
        suggestion: `Step ${index + 1} is too brief`,
        originalValue: instruction,
        suggestedValue:
          "Add more detail about technique, timing, or visual cues",
      });
    }

    if (
      !instruction.match(/\b(cook|bake|mix|add|heat|stir|combine|season)\b/i)
    ) {
      improvements.push({
        type: "instruction",
        severity: "low",
        suggestion: `Step ${index + 1} could use clearer cooking verbs`,
        originalValue: instruction,
        suggestedValue:
          "Use specific cooking verbs like 'sauté', 'simmer', 'whisk', etc.",
      });
    }
  });

  // Nutrition improvements
  if (nutrition.micronutrients.sodium > 1500) {
    improvements.push({
      type: "nutrition",
      severity: "medium",
      suggestion: "Recipe is high in sodium",
      originalValue: `${nutrition.micronutrients.sodium}mg sodium`,
      suggestedValue: "Consider reducing salt or using herbs/spices for flavor",
    });
  }

  if (
    nutrition.macros.protein < 15 &&
    !nutrition.dietaryFlags.includes("dessert")
  ) {
    improvements.push({
      type: "nutrition",
      severity: "low",
      suggestion: "Recipe could benefit from more protein",
      originalValue: `${nutrition.macros.protein}g protein`,
      suggestedValue:
        "Consider adding protein sources like beans, nuts, or lean meat",
    });
  }

  // Presentation improvements
  if (!recipe.imageUrl) {
    improvements.push({
      type: "presentation",
      severity: "low",
      suggestion: "Adding an image would make the recipe more appealing",
      suggestedValue: "Upload a photo of the finished dish",
    });
  }

  if (!recipe.description || recipe.description.length < 50) {
    improvements.push({
      type: "presentation",
      severity: "medium",
      suggestion: "Recipe could use a more detailed description",
      originalValue: recipe.description || "",
      suggestedValue:
        "Describe the dish's taste, texture, or occasion it's perfect for",
    });
  }

  return improvements;
}

/**
 * Enhance recipe title
 */
function enhanceTitle(title: string): string {
  if (!title || title.length < 3) {
    return "Delicious Recipe";
  }

  // Capitalize properly
  return title
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Enhance recipe description
 */
function enhanceDescription(
  description: string | undefined,
  nutrition: NutritionAnalysis
): string {
  if (!description || description.length < 20) {
    let enhanced = "A delicious and ";

    if (nutrition.healthScore > 70) {
      enhanced += "nutritious ";
    }

    if (nutrition.dietaryFlags.includes("vegetarian")) {
      enhanced += "vegetarian ";
    }

    enhanced += "recipe that's perfect for any occasion.";

    if (nutrition.estimatedCalories < 300) {
      enhanced += " Light and satisfying!";
    } else if (nutrition.estimatedCalories > 600) {
      enhanced += " Hearty and filling!";
    }

    return enhanced;
  }

  return description;
}

/**
 * Quick quality assessment for recipes
 */
export function quickQualityCheck(recipe: RecipeFormData): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;

  if (!recipe.title || recipe.title.length < 3) {
    issues.push("Title is too short");
    score -= 20;
  }

  if (!recipe.ingredients || recipe.ingredients.length < 2) {
    issues.push("Not enough ingredients");
    score -= 25;
  }

  if (!recipe.instructions || recipe.instructions.length < 2) {
    issues.push("Not enough cooking steps");
    score -= 25;
  }

  if (!recipe.servings || recipe.servings < 1) {
    issues.push("Invalid serving size");
    score -= 10;
  }

  const hasIncompleteIngredients = recipe.ingredients?.some(
    (ing) => !ing.name || !ing.unit || ing.amount <= 0
  );

  if (hasIncompleteIngredients) {
    issues.push("Some ingredients are incomplete");
    score -= 15;
  }

  return { score: Math.max(0, score), issues };
}
