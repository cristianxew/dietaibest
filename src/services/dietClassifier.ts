/**
 * Diet Classification Service
 *
 * Provides comprehensive diet compatibility analysis for recipes including:
 * - Ingredient-based classification (e.g., vegan if no animal products)
 * - Macronutrient ratio-based classification (e.g., keto if high fat, low carb)
 * - Confidence scoring for diet classifications
 * - Explanation generation for classification results
 */

import {
  PrismaClient,
  DietType,
  DietIngredientCompatibility,
  Ingredient as PrismaIngredient,
} from "../generated/prisma";
import { Ingredient } from "@/types/recipe";
import { ParsedIngredient } from "@/utils/ingredientParser";
import { IngredientMatch } from "@/utils/fuzzyMatcher";
import { RecipeNutrition } from "./nutritionCalculator";

const prisma = new PrismaClient();

// Type for DietType with relations
type DietTypeWithRelations = DietType & {
  dietIngredientCompatibility: (DietIngredientCompatibility & {
    ingredient: PrismaIngredient;
  })[];
};

/**
 * Diet classification result
 */
export interface DietClassification {
  dietTypeId: string;
  dietTypeName: string;
  isCompatible: boolean;
  confidence: number; // 0-100
  reasons: string[];
  violations?: string[];
  modifications?: string[];
  alternativeIngredients?: Map<string, string[]>;
}

/**
 * Overall diet analysis result
 */
export interface DietAnalysis {
  classifications: DietClassification[];
  primaryDiets: string[]; // Diets this recipe is fully compatible with
  partialDiets: string[]; // Diets with minor modifications needed
  macroAnalysis: {
    carbPercentage: number;
    proteinPercentage: number;
    fatPercentage: number;
    isKetogenic: boolean;
    isHighProtein: boolean;
    isLowFat: boolean;
    isBalanced: boolean;
  };
  warnings: string[];
  overallConfidence: number;
}

/**
 * Diet-specific thresholds and rules
 */
const DIET_RULES = {
  keto: {
    maxCarbPercentage: 10,
    minFatPercentage: 60,
    maxNetCarbs: 20, // grams per serving
  },
  lowCarb: {
    maxCarbPercentage: 25,
    maxNetCarbs: 50,
  },
  highProtein: {
    minProteinPercentage: 30,
    minProteinGrams: 25, // per serving
  },
  lowFat: {
    maxFatPercentage: 30,
    maxFatGrams: 15, // per serving
  },
  mediterranean: {
    preferredFats: ["olive oil", "nuts", "avocado", "fish"],
    limitedFoods: ["red meat", "processed foods"],
  },
  paleo: {
    forbiddenCategories: ["grains", "dairy", "legumes", "processed"],
  },
  whole30: {
    forbiddenCategories: ["grains", "dairy", "legumes", "sugar", "alcohol"],
    forbiddenIngredients: ["soy", "msg", "carrageenan"],
  },
};

/**
 * Main function to classify recipe diets
 */
export async function classifyRecipeDiets(
  ingredients: (Ingredient | ParsedIngredient)[],
  nutrition?: RecipeNutrition,
  options: {
    includeAlternatives?: boolean;
    strictMode?: boolean;
  } = {}
): Promise<DietAnalysis> {
  const warnings: string[] = [];

  try {
    // Fetch all diet types and compatibility data
    const dietTypes = await prisma.dietType.findMany({
      include: {
        dietIngredientCompatibility: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    // Fetch ingredient details from database
    const ingredientMatches = await matchIngredientsToDatabase(ingredients);

    // Classify for each diet type
    const classifications: DietClassification[] = [];

    for (const dietType of dietTypes) {
      const classification = await classifyForDiet(
        dietType,
        ingredientMatches,
        nutrition,
        options
      );
      classifications.push(classification);
    }

    // Perform macro-based analysis if nutrition data is available
    const macroAnalysis = nutrition
      ? analyzeMacroRatios(nutrition)
      : getDefaultMacroAnalysis();

    // Apply macro-based diet rules
    if (nutrition) {
      applyMacroBasedRules(classifications, nutrition, macroAnalysis);
    }

    // Determine primary and partial diet compatibility
    const primaryDiets = classifications
      .filter((c) => c.isCompatible && c.confidence >= 90)
      .map((c) => c.dietTypeName);

    const partialDiets = classifications
      .filter((c) => !c.isCompatible && c.confidence >= 60 && c.modifications)
      .map((c) => c.dietTypeName);

    // Calculate overall confidence
    const overallConfidence =
      classifications.reduce((sum, c) => sum + c.confidence, 0) /
      classifications.length;

    return {
      classifications,
      primaryDiets,
      partialDiets,
      macroAnalysis,
      warnings,
      overallConfidence,
    };
  } catch (error) {
    console.error("Error classifying recipe diets:", error);
    warnings.push("Unable to perform complete diet analysis");
    return {
      classifications: [],
      primaryDiets: [],
      partialDiets: [],
      macroAnalysis: getDefaultMacroAnalysis(),
      warnings,
      overallConfidence: 0,
    };
  }
}

/**
 * Match ingredients to database records
 */
async function matchIngredientsToDatabase(
  ingredients: (Ingredient | ParsedIngredient)[]
): Promise<Map<string, IngredientMatch>> {
  const matches = new Map<string, IngredientMatch>();

  // Fetch all ingredients from database
  const allIngredients = await prisma.ingredient.findMany();

  // Import fuzzy matcher
  const { fuzzyMatchIngredient } = await import("@/utils/fuzzyMatcher");

  for (const ingredient of ingredients) {
    const name =
      "ingredient" in ingredient ? ingredient.ingredient : ingredient.name;

    const matchResults = await fuzzyMatchIngredient(
      name as string,
      allIngredients
    );
    if (matchResults.length > 0) {
      matches.set(name as string, matchResults[0] as IngredientMatch);
    }
  }

  return matches;
}

/**
 * Classify recipe for a specific diet
 */
async function classifyForDiet(
  dietType: DietTypeWithRelations,
  ingredientMatches: Map<string, IngredientMatch>,
  nutrition?: RecipeNutrition,
  options: { includeAlternatives?: boolean; strictMode?: boolean } = {}
): Promise<DietClassification> {
  const reasons: string[] = [];
  const violations: string[] = [];
  const modifications: string[] = [];
  const alternativeIngredients = new Map<string, string[]>();

  let compatibleCount = 0;
  let incompatibleCount = 0;
  let unknownCount = 0;

  // Check each ingredient against diet compatibility
  for (const [ingredientName, match] of ingredientMatches) {
    if (!match.ingredient) {
      unknownCount++;
      continue;
    }

    // Find compatibility record
    const compatibility = dietType.dietIngredientCompatibility.find(
      (c) => c.ingredientId === match.ingredient.id
    );

    if (compatibility) {
      if (compatibility.isCompatible) {
        compatibleCount++;
        if (compatibility.compatibilityLevel === "recommended") {
          reasons.push(`${ingredientName} is recommended for ${dietType.name}`);
        }
      } else {
        incompatibleCount++;
        violations.push(
          `${ingredientName} is ${compatibility.compatibilityLevel} in ${dietType.name}`
        );

        // Suggest alternatives if requested
        if (options.includeAlternatives && compatibility.alternativeId) {
          const alternative = await prisma.ingredient.findUnique({
            where: { id: compatibility.alternativeId },
          });
          if (alternative) {
            alternativeIngredients.set(ingredientName, [alternative.name]);
            modifications.push(
              `Replace ${ingredientName} with ${alternative.name}`
            );
          }
        }
      }
    } else {
      // No specific compatibility data - apply general rules
      const generalCompatibility = await checkGeneralDietRules(
        dietType,
        match.ingredient,
        ingredientName
      );

      if (generalCompatibility.compatible) {
        compatibleCount++;
      } else {
        incompatibleCount++;
        violations.push(...generalCompatibility.violations);
      }
    }
  }

  // Calculate confidence based on known ingredients
  const totalKnown = compatibleCount + incompatibleCount;
  const confidence =
    totalKnown > 0
      ? Math.round(
          (compatibleCount / totalKnown) *
            100 *
            (1 - (unknownCount / ingredientMatches.size) * 0.2)
        ) // Reduce confidence for unknowns
      : 0;

  // Determine overall compatibility
  const isCompatible = options.strictMode
    ? incompatibleCount === 0 && unknownCount === 0
    : incompatibleCount === 0 || (confidence >= 80 && violations.length <= 2);

  return {
    dietTypeId: dietType.id,
    dietTypeName: dietType.name,
    isCompatible,
    confidence,
    reasons,
    violations: violations.length > 0 ? violations : undefined,
    modifications: modifications.length > 0 ? modifications : undefined,
    alternativeIngredients:
      alternativeIngredients.size > 0 ? alternativeIngredients : undefined,
  };
}

/**
 * Check general diet rules when specific compatibility data is not available
 */
async function checkGeneralDietRules(
  dietType: DietType,
  ingredient: PrismaIngredient,
  ingredientName: string
): Promise<{ compatible: boolean; violations: string[] }> {
  const violations: string[] = [];
  let compatible = true;

  // Check food group restrictions
  if (
    dietType.restrictedFoodGroups &&
    ingredient.foodGroup &&
    dietType.restrictedFoodGroups.includes(ingredient.foodGroup)
  ) {
    compatible = false;
    violations.push(
      `${ingredientName} belongs to restricted food group: ${ingredient.foodGroup}`
    );
  }

  // Special rules for common diets
  switch (dietType.name.toLowerCase()) {
    case "vegan":
      if (isAnimalProduct(ingredient)) {
        compatible = false;
        violations.push(`${ingredientName} is an animal product`);
      }
      break;

    case "vegetarian":
      if (isMeatOrFish(ingredient)) {
        compatible = false;
        violations.push(`${ingredientName} is meat or fish`);
      }
      break;

    case "gluten-free":
      if (containsGluten(ingredient)) {
        compatible = false;
        violations.push(`${ingredientName} contains gluten`);
      }
      break;

    case "kosher":
      if (isNonKosher(ingredient)) {
        compatible = false;
        violations.push(`${ingredientName} is not kosher`);
      }
      break;

    case "halal":
      if (isNonHalal(ingredient)) {
        compatible = false;
        violations.push(`${ingredientName} is not halal`);
      }
      break;
  }

  return { compatible, violations };
}

/**
 * Analyze macronutrient ratios
 */
function analyzeMacroRatios(
  nutrition: RecipeNutrition
): DietAnalysis["macroAnalysis"] {
  const perServing = nutrition.perServing;

  // Find macro nutrients
  const protein =
    perServing.find((n) => n.nutrient.name === "Protein")?.value || 0;
  const carbs =
    perServing.find((n) => n.nutrient.name === "Carbohydrates")?.value || 0;
  const fat =
    perServing.find((n) => n.nutrient.name === "Total Fat")?.value || 0;

  // Calculate calories from macros
  const proteinCalories = protein * 4;
  const carbCalories = carbs * 4;
  const fatCalories = fat * 9;
  const totalMacroCalories = proteinCalories + carbCalories + fatCalories;

  // Calculate percentages
  const carbPercentage =
    totalMacroCalories > 0
      ? Math.round((carbCalories / totalMacroCalories) * 100)
      : 0;
  const proteinPercentage =
    totalMacroCalories > 0
      ? Math.round((proteinCalories / totalMacroCalories) * 100)
      : 0;
  const fatPercentage =
    totalMacroCalories > 0
      ? Math.round((fatCalories / totalMacroCalories) * 100)
      : 0;

  return {
    carbPercentage,
    proteinPercentage,
    fatPercentage,
    isKetogenic:
      carbPercentage <= DIET_RULES.keto.maxCarbPercentage &&
      fatPercentage >= DIET_RULES.keto.minFatPercentage,
    isHighProtein:
      proteinPercentage >= DIET_RULES.highProtein.minProteinPercentage,
    isLowFat: fatPercentage <= DIET_RULES.lowFat.maxFatPercentage,
    isBalanced:
      Math.abs(carbPercentage - 45) <= 10 &&
      Math.abs(proteinPercentage - 25) <= 10 &&
      Math.abs(fatPercentage - 30) <= 10,
  };
}

/**
 * Apply macro-based diet rules to classifications
 */
function applyMacroBasedRules(
  classifications: DietClassification[],
  nutrition: RecipeNutrition,
  macroAnalysis: DietAnalysis["macroAnalysis"]
): void {
  // Find specific diet classifications
  const ketoClass = classifications.find(
    (c) => c.dietTypeName.toLowerCase() === "keto"
  );
  const highProteinClass = classifications.find(
    (c) =>
      c.dietTypeName.toLowerCase().includes("high protein") ||
      c.dietTypeName.toLowerCase().includes("high-protein")
  );
  const lowFatClass = classifications.find(
    (c) =>
      c.dietTypeName.toLowerCase().includes("low fat") ||
      c.dietTypeName.toLowerCase().includes("low-fat")
  );

  // Update keto classification based on macros
  if (ketoClass) {
    if (macroAnalysis.isKetogenic) {
      ketoClass.confidence = Math.max(ketoClass.confidence, 85);
      ketoClass.reasons.push(
        "Macronutrient ratios meet ketogenic requirements"
      );
    } else {
      ketoClass.isCompatible = false;
      ketoClass.confidence = Math.min(ketoClass.confidence, 50);
      ketoClass.violations = ketoClass.violations || [];
      ketoClass.violations.push(
        `Carbohydrates too high: ${macroAnalysis.carbPercentage}% (max ${DIET_RULES.keto.maxCarbPercentage}%)`
      );
    }
  }

  // Update high protein classification
  if (highProteinClass && macroAnalysis.isHighProtein) {
    highProteinClass.confidence = Math.max(highProteinClass.confidence, 90);
    highProteinClass.reasons.push(
      `High protein content: ${macroAnalysis.proteinPercentage}%`
    );
  }

  // Update low fat classification
  if (lowFatClass && macroAnalysis.isLowFat) {
    lowFatClass.confidence = Math.max(lowFatClass.confidence, 90);
    lowFatClass.reasons.push(
      `Low fat content: ${macroAnalysis.fatPercentage}%`
    );
  }
}

/**
 * Helper functions for ingredient classification
 */
function isAnimalProduct(ingredient: PrismaIngredient): boolean {
  const animalGroups = ["Meat", "Poultry", "Fish", "Seafood", "Dairy", "Eggs"];
  const animalKeywords = [
    "meat",
    "chicken",
    "beef",
    "pork",
    "fish",
    "milk",
    "cheese",
    "egg",
    "butter",
    "cream",
    "yogurt",
    "honey",
  ];

  return (
    (ingredient.foodGroup && animalGroups.includes(ingredient.foodGroup)) ||
    animalKeywords.some(
      (keyword) =>
        ingredient.name.toLowerCase().includes(keyword) ||
        (ingredient.description &&
          ingredient.description.toLowerCase().includes(keyword))
    )
  );
}

function isMeatOrFish(ingredient: PrismaIngredient): boolean {
  const meatGroups = ["Meat", "Poultry", "Fish", "Seafood"];
  return ingredient.foodGroup
    ? meatGroups.includes(ingredient.foodGroup)
    : false;
}

function containsGluten(ingredient: PrismaIngredient): boolean {
  const glutenGrains = [
    "wheat",
    "barley",
    "rye",
    "spelt",
    "kamut",
    "triticale",
  ];
  const glutenProducts = ["flour", "bread", "pasta", "cereal", "beer", "malt"];

  const name = ingredient.name.toLowerCase();
  const desc = (ingredient.description || "").toLowerCase();

  return (
    glutenGrains.some(
      (grain) => name.includes(grain) || desc.includes(grain)
    ) ||
    glutenProducts.some(
      (product) => name.includes(product) || desc.includes(product)
    )
  );
}

function isNonKosher(ingredient: PrismaIngredient): boolean {
  const nonKosherItems = [
    "pork",
    "shellfish",
    "lobster",
    "crab",
    "shrimp",
    "oyster",
    "clam",
    "bacon",
    "ham",
  ];
  const name = ingredient.name.toLowerCase();

  return nonKosherItems.some((item) => name.includes(item));
}

function isNonHalal(ingredient: PrismaIngredient): boolean {
  const nonHalalItems = [
    "pork",
    "bacon",
    "ham",
    "alcohol",
    "wine",
    "beer",
    "liquor",
    "gelatin",
  ];
  const name = ingredient.name.toLowerCase();

  return nonHalalItems.some((item) => name.includes(item));
}

/**
 * Get default macro analysis when nutrition data is not available
 */
function getDefaultMacroAnalysis(): DietAnalysis["macroAnalysis"] {
  return {
    carbPercentage: 0,
    proteinPercentage: 0,
    fatPercentage: 0,
    isKetogenic: false,
    isHighProtein: false,
    isLowFat: false,
    isBalanced: false,
  };
}

/**
 * Generate diet recommendation text
 */
export function generateDietRecommendation(
  analysis: DietAnalysis,
  targetDiet?: string
): string {
  if (targetDiet) {
    const classification = analysis.classifications.find(
      (c) => c.dietTypeName.toLowerCase() === targetDiet.toLowerCase()
    );

    if (classification) {
      if (classification.isCompatible) {
        return `This recipe is ${classification.confidence}% compatible with ${
          classification.dietTypeName
        } diet. ${classification.reasons.join(". ")}`;
      } else {
        const modText = classification.modifications?.length
          ? ` However, it can be adapted with these changes: ${classification.modifications.join(
              ", "
            )}`
          : "";
        return `This recipe is not fully compatible with ${
          classification.dietTypeName
        } diet. ${classification.violations?.join(". ")}${modText}`;
      }
    }
  }

  // General recommendation
  if (analysis.primaryDiets.length > 0) {
    return `This recipe is suitable for: ${analysis.primaryDiets.join(", ")}`;
  } else if (analysis.partialDiets.length > 0) {
    return `This recipe can be adapted for: ${analysis.partialDiets.join(
      ", "
    )} with minor modifications`;
  } else {
    return "This recipe may require significant modifications for most restrictive diets";
  }
}
