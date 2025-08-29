/**
 * Allergen Detection Service
 *
 * Provides comprehensive allergen detection for recipes including:
 * - Direct allergen detection from ingredient database
 * - Derived allergen detection (ingredients that contain allergens)
 * - Cross-contamination risk assessment
 * - Confidence scoring for allergen detection
 * - Allergen grouping for related allergens
 * - User-friendly allergen reporting
 * - Severity classification for different allergen types
 */

import {
  PrismaClient,
  Allergen,
  IngredientAllergen,
  Ingredient as PrismaIngredient,
} from "../generated/prisma";
import { Ingredient } from "@/types/recipe";
import { ParsedIngredient } from "@/utils/ingredientParser";
import { IngredientMatch } from "@/utils/fuzzyMatcher";

const prisma = new PrismaClient();

/**
 * Allergen detection result for a single allergen
 */
export interface AllergenDetection {
  allergenId: string;
  allergenName: string;
  category: string; // "food_allergy", "intolerance", "sensitivity"
  severity: string; // "mild", "moderate", "severe"
  detectionType: "direct" | "derived" | "cross-contamination";
  confidence: number; // 0-100
  sources: string[]; // Ingredient names that contain this allergen
  containsAmount?: string; // "trace", "significant", "primary"
  warnings?: string[];
}

/**
 * Overall allergen analysis result
 */
export interface AllergenAnalysis {
  detectedAllergens: AllergenDetection[];
  allergenGroups: Map<string, AllergenDetection[]>; // Grouped by category
  riskLevel: "none" | "low" | "moderate" | "high" | "severe";
  crossContaminationRisks: AllergenDetection[];
  recommendedLabels: string[];
  substitutionSuggestions?: Map<string, string[]>;
  warnings: string[];
  overallConfidence: number;
}

/**
 * Allergen risk assessment options
 */
export interface AllergenDetectionOptions {
  includeCrossContamination?: boolean;
  sensitivityLevel?: "standard" | "high"; // High includes trace amounts
  includeSubstitutions?: boolean;
  userAllergens?: string[]; // Specific allergens to check for
}

/**
 * Cross-contamination risk factors
 */
const CROSS_CONTAMINATION_RISKS = {
  // Ingredients often processed in facilities with allergens
  oats: ["gluten", "wheat"],
  chocolate: ["milk", "tree nuts", "soy"],
  flour: ["gluten", "wheat"],
  "dried fruit": ["tree nuts", "sulfites"],
  granola: ["tree nuts", "peanuts"],
  cereal: ["gluten", "milk", "soy"],
  crackers: ["gluten", "sesame"],
  "baking mix": ["gluten", "milk", "eggs"],
};

/**
 * Allergen family relationships
 */
const ALLERGEN_FAMILIES = {
  "tree nuts": [
    "almonds",
    "cashews",
    "walnuts",
    "pecans",
    "hazelnuts",
    "pistachios",
    "brazil nuts",
    "macadamia nuts",
    "pine nuts",
  ],
  shellfish: [
    "shrimp",
    "crab",
    "lobster",
    "crayfish",
    "prawns",
    "scallops",
    "clams",
    "mussels",
    "oysters",
    "squid",
    "octopus",
  ],
  legumes: ["peanuts", "soybeans", "peas", "lentils", "beans"],
  nightshades: ["tomatoes", "potatoes", "peppers", "eggplant"],
};

/**
 * Main function to detect allergens in a recipe
 */
export async function detectRecipeAllergens(
  ingredients: (Ingredient | ParsedIngredient)[],
  options: AllergenDetectionOptions = {}
): Promise<AllergenAnalysis> {
  const warnings: string[] = [];
  const opts: Required<AllergenDetectionOptions> = {
    includeCrossContamination: true,
    sensitivityLevel: "standard" as const,
    includeSubstitutions: false,
    userAllergens: [],
    ...options,
  };

  try {
    // Fetch all allergens from database
    const allergens = await prisma.allergen.findMany({
      include: {
        ingredientAllergens: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    // Match ingredients to database
    const ingredientMatches = await matchIngredientsToDatabase(ingredients);

    // Detect allergens
    const detectedAllergens: AllergenDetection[] = [];
    const processedAllergenIds = new Set<string>();

    // Direct allergen detection
    for (const [ingredientName, match] of ingredientMatches) {
      if (!match.ingredient) continue;

      for (const allergen of allergens) {
        const allergenDetection = await detectAllergenInIngredient(
          allergen,
          match.ingredient,
          ingredientName,
          opts
        );

        if (
          allergenDetection &&
          !processedAllergenIds.has(allergenDetection.allergenId)
        ) {
          detectedAllergens.push(allergenDetection);
          processedAllergenIds.add(allergenDetection.allergenId);
        } else if (allergenDetection) {
          // Add source to existing detection
          const existing = detectedAllergens.find(
            (d) => d.allergenId === allergenDetection.allergenId
          );
          if (existing && !existing.sources.includes(ingredientName)) {
            existing.sources.push(ingredientName);
            existing.confidence = Math.max(
              existing.confidence,
              allergenDetection.confidence
            );
          }
        }
      }
    }

    // Cross-contamination detection
    const crossContaminationRisks: AllergenDetection[] = [];
    if (opts.includeCrossContamination) {
      const crossRisks = await detectCrossContamination(
        ingredientMatches,
        allergens
      );
      crossContaminationRisks.push(...crossRisks);

      // Add to main list if not already detected
      for (const risk of crossRisks) {
        if (!processedAllergenIds.has(risk.allergenId)) {
          detectedAllergens.push(risk);
          processedAllergenIds.add(risk.allergenId);
        }
      }
    }

    // Group allergens by category
    const allergenGroups = groupAllergensByCategory(detectedAllergens);

    // Assess overall risk level
    const riskLevel = assessOverallRisk(detectedAllergens);

    // Generate recommended labels
    const recommendedLabels = generateAllergenLabels(
      detectedAllergens,
      crossContaminationRisks
    );

    // Generate substitution suggestions if requested
    const substitutionSuggestions = opts.includeSubstitutions
      ? await generateSubstitutions(detectedAllergens)
      : undefined;

    // Calculate overall confidence
    const overallConfidence =
      detectedAllergens.length > 0
        ? Math.round(
            detectedAllergens.reduce((sum, d) => sum + d.confidence, 0) /
              detectedAllergens.length
          )
        : 100; // 100% confident there are no allergens

    return {
      detectedAllergens,
      allergenGroups,
      riskLevel,
      crossContaminationRisks,
      recommendedLabels,
      substitutionSuggestions,
      warnings,
      overallConfidence,
    };
  } catch (error) {
    console.error("Error detecting allergens:", error);
    warnings.push("Unable to perform complete allergen analysis");
    return {
      detectedAllergens: [],
      allergenGroups: new Map(),
      riskLevel: "none",
      crossContaminationRisks: [],
      recommendedLabels: [],
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
 * Detect allergen in a specific ingredient
 */
async function detectAllergenInIngredient(
  allergen: Allergen & {
    ingredientAllergens: (IngredientAllergen & {
      ingredient: PrismaIngredient;
    })[];
  },
  ingredient: PrismaIngredient,
  ingredientName: string,
  options: Required<AllergenDetectionOptions>
): Promise<AllergenDetection | null> {
  // Check direct allergen link
  const directLink = allergen.ingredientAllergens.find(
    (ia) => ia.ingredientId === ingredient.id
  );

  if (directLink) {
    // Skip trace amounts in standard sensitivity
    if (
      options.sensitivityLevel === "standard" &&
      directLink.containsAmount === "trace"
    ) {
      return null;
    }

    return {
      allergenId: allergen.id,
      allergenName: allergen.name,
      category: allergen.category,
      severity: allergen.severityLevel,
      detectionType: directLink.isCrossContamination
        ? "cross-contamination"
        : "direct",
      confidence: directLink.containsAmount === "trace" ? 70 : 95,
      sources: [ingredientName],
      containsAmount: directLink.containsAmount || undefined,
      warnings: directLink.processingNote
        ? [directLink.processingNote]
        : undefined,
    };
  }

  // Check derived allergens (e.g., butter contains milk)
  const derivedDetection = checkDerivedAllergen(
    allergen,
    ingredient,
    ingredientName
  );
  if (derivedDetection) {
    return derivedDetection;
  }

  // Check allergen families (e.g., almonds are tree nuts)
  const familyDetection = checkAllergenFamily(
    allergen,
    ingredient,
    ingredientName
  );
  if (familyDetection) {
    return familyDetection;
  }

  return null;
}

/**
 * Check for derived allergens
 */
function checkDerivedAllergen(
  allergen: Allergen,
  ingredient: PrismaIngredient,
  ingredientName: string
): AllergenDetection | null {
  const name = ingredient.name.toLowerCase();
  const allergenName = allergen.name.toLowerCase();

  // Common derived allergen patterns
  const derivedPatterns: Record<string, string[]> = {
    milk: ["butter", "cream", "cheese", "yogurt", "whey", "casein", "lactose"],
    eggs: ["mayonnaise", "meringue", "custard", "aioli"],
    wheat: ["bread", "pasta", "couscous", "seitan", "flour"],
    soy: ["tofu", "tempeh", "miso", "edamame", "soy sauce"],
    fish: ["worcestershire", "caesar dressing", "fish sauce"],
  };

  const patterns = derivedPatterns[allergenName];
  if (patterns && patterns.some((pattern) => name.includes(pattern))) {
    return {
      allergenId: allergen.id,
      allergenName: allergen.name,
      category: allergen.category,
      severity: allergen.severityLevel,
      detectionType: "derived",
      confidence: 90,
      sources: [ingredientName],
      warnings: [`${ingredientName} is derived from ${allergen.name}`],
    };
  }

  return null;
}

/**
 * Check allergen families
 */
function checkAllergenFamily(
  allergen: Allergen,
  ingredient: PrismaIngredient,
  ingredientName: string
): AllergenDetection | null {
  const name = ingredient.name.toLowerCase();
  const allergenName = allergen.name.toLowerCase();

  // Check if ingredient belongs to an allergen family
  for (const [family, members] of Object.entries(ALLERGEN_FAMILIES)) {
    if (
      allergenName.includes(family) &&
      members.some((member) => name.includes(member))
    ) {
      return {
        allergenId: allergen.id,
        allergenName: allergen.name,
        category: allergen.category,
        severity: allergen.severityLevel,
        detectionType: "direct",
        confidence: 95,
        sources: [ingredientName],
        warnings: [`${ingredientName} is a type of ${family}`],
      };
    }
  }

  return null;
}

/**
 * Detect cross-contamination risks
 */
async function detectCrossContamination(
  ingredientMatches: Map<string, IngredientMatch>,
  allergens: Allergen[]
): Promise<AllergenDetection[]> {
  const crossContaminationRisks: AllergenDetection[] = [];
  const processedCombos = new Set<string>();

  for (const [ingredientName, match] of ingredientMatches) {
    if (!match.ingredient) continue;

    const name = match.ingredient.name.toLowerCase();

    // Check cross-contamination risk patterns
    for (const [riskIngredient, riskAllergens] of Object.entries(
      CROSS_CONTAMINATION_RISKS
    )) {
      if (name.includes(riskIngredient)) {
        for (const riskAllergenName of riskAllergens) {
          const allergen = allergens.find(
            (a) => a.name.toLowerCase() === riskAllergenName.toLowerCase()
          );

          if (allergen) {
            const comboKey = `${ingredientName}-${allergen.id}`;
            if (!processedCombos.has(comboKey)) {
              processedCombos.add(comboKey);

              crossContaminationRisks.push({
                allergenId: allergen.id,
                allergenName: allergen.name,
                category: allergen.category,
                severity: allergen.severityLevel,
                detectionType: "cross-contamination",
                confidence: 60,
                sources: [ingredientName],
                containsAmount: "trace",
                warnings: [
                  `${ingredientName} may contain traces of ${allergen.name} due to processing`,
                ],
              });
            }
          }
        }
      }
    }
  }

  return crossContaminationRisks;
}

/**
 * Group allergens by category
 */
function groupAllergensByCategory(
  allergens: AllergenDetection[]
): Map<string, AllergenDetection[]> {
  const groups = new Map<string, AllergenDetection[]>();

  for (const allergen of allergens) {
    const category = allergen.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(allergen);
  }

  // Sort each group by severity
  for (const [, group] of groups) {
    group.sort((a, b) => {
      const severityOrder = { severe: 0, moderate: 1, mild: 2 };
      return (
        (severityOrder[a.severity as keyof typeof severityOrder] || 3) -
        (severityOrder[b.severity as keyof typeof severityOrder] || 3)
      );
    });
  }

  return groups;
}

/**
 * Assess overall allergen risk level
 */
function assessOverallRisk(
  allergens: AllergenDetection[]
): AllergenAnalysis["riskLevel"] {
  if (allergens.length === 0) return "none";

  const severeCounts = allergens.filter((a) => a.severity === "severe").length;
  const moderateCounts = allergens.filter(
    (a) => a.severity === "moderate"
  ).length;
  const directCounts = allergens.filter(
    (a) => a.detectionType === "direct"
  ).length;

  if (severeCounts >= 2 || (severeCounts >= 1 && directCounts >= 1)) {
    return "severe";
  } else if (severeCounts >= 1 || moderateCounts >= 3) {
    return "high";
  } else if (moderateCounts >= 2 || directCounts >= 2) {
    return "moderate";
  } else if (allergens.length >= 1) {
    return "low";
  }

  return "none";
}

/**
 * Generate allergen labels for the recipe
 */
function generateAllergenLabels(
  allergens: AllergenDetection[],
  crossContaminationRisks: AllergenDetection[]
): string[] {
  const labels: string[] = [];

  // Main allergen warnings
  const directAllergens = allergens
    .filter(
      (a) => a.detectionType === "direct" || a.detectionType === "derived"
    )
    .map((a) => a.allergenName);

  if (directAllergens.length > 0) {
    labels.push(`Contains: ${directAllergens.join(", ")}`);
  }

  // Cross-contamination warnings
  const crossAllergens = crossContaminationRisks
    .map((a) => a.allergenName)
    .filter((name, index, self) => self.indexOf(name) === index);

  if (crossAllergens.length > 0) {
    labels.push(`May contain traces of: ${crossAllergens.join(", ")}`);
  }

  // Special diet labels
  const hasGluten = allergens.some(
    (a) =>
      a.allergenName.toLowerCase() === "gluten" ||
      a.allergenName.toLowerCase() === "wheat"
  );
  const hasDairy = allergens.some(
    (a) =>
      a.allergenName.toLowerCase() === "milk" ||
      a.allergenName.toLowerCase() === "lactose"
  );
  const hasNuts = allergens.some(
    (a) =>
      a.allergenName.toLowerCase().includes("nut") ||
      a.allergenName.toLowerCase() === "peanuts"
  );

  if (!hasGluten) labels.push("Gluten-Free");
  if (!hasDairy) labels.push("Dairy-Free");
  if (!hasNuts) labels.push("Nut-Free");

  return labels;
}

/**
 * Generate substitution suggestions for allergens
 */
async function generateSubstitutions(
  allergens: AllergenDetection[]
): Promise<Map<string, string[]>> {
  const substitutions = new Map<string, string[]>();

  // Common allergen substitutions
  const commonSubstitutions: Record<string, string[]> = {
    milk: ["almond milk", "soy milk", "oat milk", "coconut milk"],
    butter: ["vegan butter", "coconut oil", "olive oil"],
    eggs: ["flax eggs", "chia eggs", "applesauce", "banana"],
    wheat: ["almond flour", "coconut flour", "rice flour", "oat flour"],
    peanuts: ["sunflower seeds", "pumpkin seeds", "almond butter"],
    soy: ["coconut aminos", "tamari (if gluten-free needed)"],
  };

  for (const allergen of allergens) {
    const sources = allergen.sources;

    for (const source of sources) {
      if (!substitutions.has(source)) {
        const substitutionList: string[] = [];

        // Check common substitutions
        const allergenKey = allergen.allergenName.toLowerCase();
        if (commonSubstitutions[allergenKey]) {
          substitutionList.push(...commonSubstitutions[allergenKey]);
        }

        // Check ingredient-specific substitutions
        const sourceKey = source.toLowerCase();
        if (commonSubstitutions[sourceKey]) {
          substitutionList.push(...commonSubstitutions[sourceKey]);
        }

        if (substitutionList.length > 0) {
          substitutions.set(source, substitutionList);
        }
      }
    }
  }

  return substitutions;
}

/**
 * Generate allergen warning text
 */
export function generateAllergenWarning(
  analysis: AllergenAnalysis,
  userAllergens?: string[]
): string {
  if (analysis.detectedAllergens.length === 0) {
    return "No common allergens detected in this recipe.";
  }

  let warning = "";

  // Check for user-specific allergens
  if (userAllergens && userAllergens.length > 0) {
    const userAllergenDetections = analysis.detectedAllergens.filter((a) =>
      userAllergens.some(
        (ua) => ua.toLowerCase() === a.allergenName.toLowerCase()
      )
    );

    if (userAllergenDetections.length > 0) {
      warning +=
        "⚠️ WARNING: This recipe contains allergens you've indicated: ";
      warning += userAllergenDetections.map((a) => a.allergenName).join(", ");
      warning += "\n\n";
    }
  }

  // General allergen information
  const severeAllergens = analysis.detectedAllergens.filter(
    (a) => a.severity === "severe"
  );
  if (severeAllergens.length > 0) {
    warning += "🚨 Severe Allergens: ";
    warning += severeAllergens
      .map((a) => `${a.allergenName} (${a.sources.join(", ")})`)
      .join("; ");
    warning += "\n";
  }

  const moderateAllergens = analysis.detectedAllergens.filter(
    (a) => a.severity === "moderate"
  );
  if (moderateAllergens.length > 0) {
    warning += "⚠️ Moderate Allergens: ";
    warning += moderateAllergens.map((a) => a.allergenName).join(", ");
    warning += "\n";
  }

  if (analysis.crossContaminationRisks.length > 0) {
    warning += "ℹ️ May contain traces of: ";
    warning += analysis.crossContaminationRisks
      .map((a) => a.allergenName)
      .join(", ");
  }

  return warning.trim();
}

/**
 * Check if recipe is safe for specific allergen restrictions
 */
export function isRecipeSafeFor(
  analysis: AllergenAnalysis,
  allergenRestrictions: string[]
): { isSafe: boolean; violations: string[]; suggestions?: string[] } {
  const violations: string[] = [];
  const suggestions: string[] = [];

  for (const restriction of allergenRestrictions) {
    const restrictionLower = restriction.toLowerCase();

    const found = analysis.detectedAllergens.find(
      (a) =>
        a.allergenName.toLowerCase() === restrictionLower ||
        a.allergenName.toLowerCase().includes(restrictionLower)
    );

    if (found) {
      violations.push(
        `Contains ${found.allergenName} in: ${found.sources.join(", ")}`
      );

      // Add substitution suggestions if available
      if (analysis.substitutionSuggestions) {
        for (const source of found.sources) {
          const subs = analysis.substitutionSuggestions.get(source);
          if (subs) {
            suggestions.push(`Replace ${source} with: ${subs.join(" or ")}`);
          }
        }
      }
    }
  }

  return {
    isSafe: violations.length === 0,
    violations,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}
