/**
 * Nutrient Definitions - Single Source of Truth
 *
 * Comprehensive nutrient metadata including:
 * - All ID variations (USDA, custom UUIDs)
 * - Name variations for flexible matching
 * - Daily values for DV% calculations
 * - Units and categories
 *
 * This is the single source of truth for nutrient information across the app.
 */

export interface NutrientDefinition {
  /** Unique nutrient ID (USDA format without prefix) */
  id: string;
  /** Official nutrient name */
  name: string;
  /** All possible name variations for matching */
  names: string[];
  /** Standard unit of measurement */
  unit: string;
  /** Nutrient category */
  category: "Energy" | "Macronutrients" | "Vitamins" | "Minerals" | "Other";
  /** Daily value for adults (optional, for DV% calculations) */
  dailyValue?: number;
  /** Description/notes */
  description?: string;
}

/**
 * Complete nutrient definitions catalog
 * Organized by importance: macros, vitamins, minerals
 */
export const NUTRIENT_DEFINITIONS: Record<string, NutrientDefinition> = {
  // ENERGY & MACRONUTRIENTS
  ENERGY: {
    id: "1008",
    name: "Energy",
    names: ["energy", "calories", "kcal"],
    unit: "kcal",
    category: "Energy",
    dailyValue: 2000,
    description: "Energy content in kilocalories",
  },
  PROTEIN: {
    id: "1003",
    name: "Protein",
    names: ["protein"],
    unit: "g",
    category: "Macronutrients",
    dailyValue: 50,
    description: "Total protein content",
  },
  CARBS: {
    id: "1005",
    name: "Carbohydrate",
    names: ["carbohydrate", "carbohydrates", "total carbohydrates", "carbs"],
    unit: "g",
    category: "Macronutrients",
    dailyValue: 275,
    description: "Total carbohydrates",
  },
  FAT: {
    id: "1004",
    name: "Total Fat",
    names: ["total fat", "fat", "total lipid", "lipid"],
    unit: "g",
    category: "Macronutrients",
    dailyValue: 78,
    description: "Total fat content",
  },
  FIBER: {
    id: "1079",
    name: "Fiber",
    names: ["fiber", "dietary fiber", "total dietary fiber"],
    unit: "g",
    category: "Macronutrients",
    dailyValue: 28,
    description: "Total dietary fiber",
  },
  SUGAR: {
    id: "2000",
    name: "Total Sugars",
    names: ["sugar", "sugars", "total sugars"],
    unit: "g",
    category: "Macronutrients",
    dailyValue: 50, // Added sugars DV
    description: "Total sugars",
  },

  // FATS (detailed)
  SATURATED_FAT: {
    id: "1258",
    name: "Saturated Fat",
    names: [
      "saturated fat",
      "saturated fatty acids",
      "fatty acids, total saturated",
    ],
    unit: "g",
    category: "Macronutrients",
    dailyValue: 20,
    description: "Saturated fatty acids",
  },
  TRANS_FAT: {
    id: "1257",
    name: "Trans Fat",
    names: ["trans fat", "trans fatty acids", "fatty acids, total trans"],
    unit: "g",
    category: "Macronutrients",
    description: "Trans fatty acids",
  },
  MONOUNSATURATED_FAT: {
    id: "1292",
    name: "Monounsaturated Fat",
    names: [
      "monounsaturated fat",
      "monounsaturated fatty acids",
      "fatty acids, total monounsaturated",
    ],
    unit: "g",
    category: "Macronutrients",
    description: "Monounsaturated fatty acids",
  },
  POLYUNSATURATED_FAT: {
    id: "1293",
    name: "Polyunsaturated Fat",
    names: [
      "polyunsaturated fat",
      "polyunsaturated fatty acids",
      "fatty acids, total polyunsaturated",
    ],
    unit: "g",
    category: "Macronutrients",
    description: "Polyunsaturated fatty acids",
  },
  CHOLESTEROL: {
    id: "1253",
    name: "Cholesterol",
    names: ["cholesterol"],
    unit: "mg",
    category: "Macronutrients",
    dailyValue: 300,
    description: "Cholesterol content",
  },

  // MINERALS
  SODIUM: {
    id: "1093",
    name: "Sodium",
    names: ["sodium"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 2300,
    description: "Sodium content",
  },
  CALCIUM: {
    id: "1087",
    name: "Calcium",
    names: ["calcium"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 1300,
    description: "Calcium content",
  },
  IRON: {
    id: "1089",
    name: "Iron",
    names: ["iron"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 18,
    description: "Iron content",
  },
  POTASSIUM: {
    id: "1092",
    name: "Potassium",
    names: ["potassium"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 4700,
    description: "Potassium content",
  },
  MAGNESIUM: {
    id: "1090",
    name: "Magnesium",
    names: ["magnesium"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 420,
    description: "Magnesium content",
  },
  PHOSPHORUS: {
    id: "1091",
    name: "Phosphorus",
    names: ["phosphorus"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 1250,
    description: "Phosphorus content",
  },
  ZINC: {
    id: "1095",
    name: "Zinc",
    names: ["zinc"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 11,
    description: "Zinc content",
  },
  SELENIUM: {
    id: "1103",
    name: "Selenium",
    names: ["selenium"],
    unit: "µg",
    category: "Minerals",
    dailyValue: 55,
    description: "Selenium content",
  },
  COPPER: {
    id: "1098",
    name: "Copper",
    names: ["copper"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 0.9,
    description: "Copper content",
  },
  MANGANESE: {
    id: "1101",
    name: "Manganese",
    names: ["manganese"],
    unit: "mg",
    category: "Minerals",
    dailyValue: 2.3,
    description: "Manganese content",
  },

  // VITAMINS
  VITAMIN_A: {
    id: "1106",
    name: "Vitamin A",
    names: ["vitamin a", "vitamin a, iu", "retinol"],
    unit: "µg",
    category: "Vitamins",
    dailyValue: 900,
    description: "Vitamin A (RAE)",
  },
  VITAMIN_C: {
    id: "1162",
    name: "Vitamin C",
    names: ["vitamin c", "ascorbic acid"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 90,
    description: "Vitamin C (ascorbic acid)",
  },
  VITAMIN_D: {
    id: "1114",
    name: "Vitamin D",
    names: ["vitamin d", "vitamin d (d2 + d3)", "vitamin d2", "vitamin d3"],
    unit: "µg",
    category: "Vitamins",
    dailyValue: 20,
    description: "Vitamin D (D2 + D3)",
  },
  VITAMIN_E: {
    id: "1109",
    name: "Vitamin E",
    names: ["vitamin e", "alpha-tocopherol"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 15,
    description: "Vitamin E (alpha-tocopherol)",
  },
  VITAMIN_K: {
    id: "1185",
    name: "Vitamin K",
    names: ["vitamin k", "phylloquinone"],
    unit: "µg",
    category: "Vitamins",
    dailyValue: 120,
    description: "Vitamin K (phylloquinone)",
  },
  THIAMIN: {
    id: "1165",
    name: "Thiamin",
    names: ["thiamin", "thiamine", "vitamin b1"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 1.2,
    description: "Thiamin (Vitamin B1)",
  },
  RIBOFLAVIN: {
    id: "1166",
    name: "Riboflavin",
    names: ["riboflavin", "vitamin b2"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 1.3,
    description: "Riboflavin (Vitamin B2)",
  },
  NIACIN: {
    id: "1167",
    name: "Niacin",
    names: ["niacin", "vitamin b3"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 16,
    description: "Niacin (Vitamin B3)",
  },
  VITAMIN_B6: {
    id: "1175",
    name: "Vitamin B6",
    names: ["vitamin b6", "pyridoxine"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 1.7,
    description: "Vitamin B6 (pyridoxine)",
  },
  FOLATE: {
    id: "1177",
    name: "Folate",
    names: ["folate", "folic acid", "vitamin b9"],
    unit: "µg",
    category: "Vitamins",
    dailyValue: 400,
    description: "Folate (Vitamin B9)",
  },
  VITAMIN_B12: {
    id: "1178",
    name: "Vitamin B12",
    names: ["vitamin b12", "cobalamin"],
    unit: "µg",
    category: "Vitamins",
    dailyValue: 2.4,
    description: "Vitamin B12 (cobalamin)",
  },
  PANTOTHENIC_ACID: {
    id: "1170",
    name: "Pantothenic Acid",
    names: ["pantothenic acid", "vitamin b5"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 5,
    description: "Pantothenic Acid (Vitamin B5)",
  },
  BIOTIN: {
    id: "1176",
    name: "Biotin",
    names: ["biotin", "vitamin b7"],
    unit: "µg",
    category: "Vitamins",
    dailyValue: 30,
    description: "Biotin (Vitamin B7)",
  },
  CHOLINE: {
    id: "1180",
    name: "Choline",
    names: ["choline"],
    unit: "mg",
    category: "Vitamins",
    dailyValue: 550,
    description: "Choline",
  },
};

/**
 * Get nutrient definition by ID
 * Handles ID normalization (removes "usda:" prefix if present)
 */
export function getNutrientDefinition(
  id: string
): NutrientDefinition | undefined {
  // Normalize the ID (remove prefix if present)
  const normalizedId = id.replace(/^usda:/, "");

  // Look up by normalized ID
  for (const def of Object.values(NUTRIENT_DEFINITIONS)) {
    if (def.id === normalizedId) return def;
  }

  return undefined;
}

/**
 * Get nutrient definition by name
 */
export function getNutrientDefinitionByName(
  name: string
): NutrientDefinition | undefined {
  const normalized = name.toLowerCase().trim();

  for (const def of Object.values(NUTRIENT_DEFINITIONS)) {
    // Check primary name
    if (def.name.toLowerCase() === normalized) return def;

    // Check name variations
    if (def.names.some((n) => n.toLowerCase() === normalized)) return def;
  }

  return undefined;
}

/**
 * Quick access to key nutrient IDs (backwards compatibility)
 */
export const NUTRIENT_IDS = {
  ENERGY: NUTRIENT_DEFINITIONS.ENERGY.id,
  PROTEIN: NUTRIENT_DEFINITIONS.PROTEIN.id,
  FAT: NUTRIENT_DEFINITIONS.FAT.id,
  CARBS: NUTRIENT_DEFINITIONS.CARBS.id,
  FIBER: NUTRIENT_DEFINITIONS.FIBER.id,
  SUGAR: NUTRIENT_DEFINITIONS.SUGAR.id,
  SODIUM: NUTRIENT_DEFINITIONS.SODIUM.id,
  SATURATED_FAT: NUTRIENT_DEFINITIONS.SATURATED_FAT.id,
  CHOLESTEROL: NUTRIENT_DEFINITIONS.CHOLESTEROL.id,
  CALCIUM: NUTRIENT_DEFINITIONS.CALCIUM.id,
  IRON: NUTRIENT_DEFINITIONS.IRON.id,
  POTASSIUM: NUTRIENT_DEFINITIONS.POTASSIUM.id,
  VITAMIN_A: NUTRIENT_DEFINITIONS.VITAMIN_A.id,
  VITAMIN_C: NUTRIENT_DEFINITIONS.VITAMIN_C.id,
  VITAMIN_D: NUTRIENT_DEFINITIONS.VITAMIN_D.id,
} as const;

/**
 * Get all macro nutrients (for nutrition labels)
 */
export const MACRO_NUTRIENTS = [
  NUTRIENT_DEFINITIONS.ENERGY,
  NUTRIENT_DEFINITIONS.PROTEIN,
  NUTRIENT_DEFINITIONS.CARBS,
  NUTRIENT_DEFINITIONS.FAT,
  NUTRIENT_DEFINITIONS.FIBER,
  NUTRIENT_DEFINITIONS.SUGAR,
] as const;

/**
 * Get all key display nutrients (for summary cards)
 */
export const KEY_DISPLAY_NUTRIENTS = [
  NUTRIENT_DEFINITIONS.ENERGY,
  NUTRIENT_DEFINITIONS.PROTEIN,
  NUTRIENT_DEFINITIONS.CARBS,
  NUTRIENT_DEFINITIONS.FAT,
  NUTRIENT_DEFINITIONS.FIBER,
  NUTRIENT_DEFINITIONS.SUGAR,
  NUTRIENT_DEFINITIONS.SODIUM,
] as const;
