/**
 * Ingredient Parser Module
 *
 * This module parses ingredient strings from recipes to extract:
 * - Quantity (numeric value)
 * - Unit (measurement unit)
 * - Ingredient name
 * - Preparation notes (optional)
 *
 * Example: "2 cups all-purpose flour, sifted" ->
 * { quantity: 2, unit: "cups", name: "all-purpose flour", preparation: "sifted" }
 */

// Common fraction unicode mappings
const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 0.333333,
  "⅔": 0.666667,
  "¼": 0.25,
  "¾": 0.75,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 0.166667,
  "⅚": 0.833333,
  "⅐": 0.142857,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
  "⅑": 0.111111,
  "⅒": 0.1,
};

// Common text fractions
const TEXT_FRACTIONS: Record<string, number> = {
  half: 0.5,
  third: 0.333333,
  quarter: 0.25,
  eighth: 0.125,
};

// Common measurement units (normalized to standard forms)
const UNIT_NORMALIZATIONS: Record<string, string> = {
  // Volume
  cups: "cup",
  cup: "cup",
  c: "cup",
  tablespoons: "tablespoon",
  tablespoon: "tablespoon",
  tbsp: "tablespoon",
  tbs: "tablespoon",
  T: "tablespoon",
  teaspoons: "teaspoon",
  teaspoon: "teaspoon",
  tsp: "teaspoon",
  t: "teaspoon",
  "fluid ounces": "fl oz",
  "fluid ounce": "fl oz",
  "fl oz": "fl oz",
  "fluid oz": "fl oz",
  oz: "oz",
  ounces: "oz",
  ounce: "oz",
  milliliters: "ml",
  milliliter: "ml",
  ml: "ml",
  liters: "liter",
  liter: "liter",
  l: "liter",
  gallons: "gallon",
  gallon: "gallon",
  gal: "gallon",
  pints: "pint",
  pint: "pint",
  pt: "pint",
  quarts: "quart",
  quart: "quart",
  qt: "quart",

  // Weight
  pounds: "lb",
  pound: "lb",
  lbs: "lb",
  lb: "lb",
  grams: "g",
  gram: "g",
  g: "g",
  kilograms: "kg",
  kilogram: "kg",
  kg: "kg",
  milligrams: "mg",
  milligram: "mg",
  mg: "mg",

  // Common cooking units
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
  clove: "clove",
  cloves: "clove",
  bunch: "bunch",
  bunches: "bunch",
  can: "can",
  cans: "can",
  package: "package",
  packages: "package",
  pkg: "package",
  slice: "slice",
  slices: "slice",
  piece: "piece",
  pieces: "piece",
  stick: "stick",
  sticks: "stick",
  head: "head",
  heads: "head",
  sprig: "sprig",
  sprigs: "sprig",
};

// Common preparation methods to extract
const PREPARATION_PATTERNS = [
  "chopped",
  "diced",
  "minced",
  "sliced",
  "grated",
  "shredded",
  "crushed",
  "ground",
  "whole",
  "fresh",
  "dried",
  "frozen",
  "thawed",
  "cooked",
  "raw",
  "peeled",
  "seeded",
  "stemmed",
  "trimmed",
  "halved",
  "quartered",
  "cubed",
  "julienned",
  "zested",
  "juiced",
  "melted",
  "softened",
  "sifted",
  "packed",
  "unpacked",
  "room temperature",
  "cold",
  "warm",
  "hot",
];

export interface ParsedIngredient {
  originalText: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  preparation: string | null;
  confidence: number; // 0-1 confidence score
  errors: string[];
}

/**
 * Parse a fraction string (e.g., "1/2", "1 1/2") into a decimal number
 */
function parseFraction(fractionStr: string): number | null {
  try {
    // Check for unicode fractions
    if (UNICODE_FRACTIONS[fractionStr]) {
      return UNICODE_FRACTIONS[fractionStr];
    }

    // Check for text fractions
    const lowerStr = fractionStr.toLowerCase();
    if (TEXT_FRACTIONS[lowerStr]) {
      return TEXT_FRACTIONS[lowerStr];
    }

    // Handle mixed numbers (e.g., "1 1/2")
    const mixedMatch = fractionStr.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixedMatch) {
      const whole = parseInt(mixedMatch[1], 10);
      const numerator = parseInt(mixedMatch[2], 10);
      const denominator = parseInt(mixedMatch[3], 10);
      return whole + numerator / denominator;
    }

    // Handle simple fractions (e.g., "1/2")
    const fractionMatch = fractionStr.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      const numerator = parseInt(fractionMatch[1], 10);
      const denominator = parseInt(fractionMatch[2], 10);
      return numerator / denominator;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse quantity from the beginning of an ingredient string
 */
function parseQuantity(text: string): {
  quantity: number | null;
  remainingText: string;
} {
  // Remove leading/trailing whitespace
  const trimmedText = text.trim();

  // Try to match quantity patterns at the beginning
  // Pattern 1: Decimal number (e.g., "1.5", "2", "0.5")
  const decimalMatch = trimmedText.match(/^(\d+\.?\d*)\s*/);
  if (decimalMatch) {
    return {
      quantity: parseFloat(decimalMatch[1]),
      remainingText: trimmedText.substring(decimalMatch[0].length),
    };
  }

  // Pattern 2: Mixed number (e.g., "1 1/2")
  const mixedMatch = trimmedText.match(/^(\d+)\s+(\d+\/\d+)\s*/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const fraction = parseFraction(mixedMatch[2]);
    if (fraction !== null) {
      return {
        quantity: whole + fraction,
        remainingText: trimmedText.substring(mixedMatch[0].length),
      };
    }
  }

  // Pattern 3: Simple fraction (e.g., "1/2")
  const fractionMatch = trimmedText.match(/^(\d+\/\d+)\s*/);
  if (fractionMatch) {
    const fraction = parseFraction(fractionMatch[1]);
    if (fraction !== null) {
      return {
        quantity: fraction,
        remainingText: trimmedText.substring(fractionMatch[0].length),
      };
    }
  }

  // Pattern 4: Unicode fraction
  const unicodeFractionMatch = trimmedText.match(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])\s*/);
  if (unicodeFractionMatch) {
    const fraction = parseFraction(unicodeFractionMatch[1]);
    if (fraction !== null) {
      return {
        quantity: fraction,
        remainingText: trimmedText.substring(unicodeFractionMatch[0].length),
      };
    }
  }

  // Pattern 5: Text numbers (e.g., "a", "one", "two")
  const textNumberMap: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    dozen: 12,
  };

  const textNumberPattern = new RegExp(
    `^(${Object.keys(textNumberMap).join("|")})\\s+`,
    "i"
  );
  const textNumberMatch = trimmedText.match(textNumberPattern);
  if (textNumberMatch) {
    return {
      quantity: textNumberMap[textNumberMatch[1].toLowerCase()],
      remainingText: trimmedText.substring(textNumberMatch[0].length),
    };
  }

  // No quantity found
  return {
    quantity: null,
    remainingText: trimmedText,
  };
}

/**
 * Parse unit from the text
 */
function parseUnit(text: string): {
  unit: string | null;
  remainingText: string;
} {
  const trimmedText = text.trim();

  // Build pattern from known units
  const unitPattern = Object.keys(UNIT_NORMALIZATIONS)
    .sort((a, b) => b.length - a.length) // Sort by length descending to match longer units first
    .map((unit) => unit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) // Escape regex special chars
    .join("|");

  const unitRegex = new RegExp(`^(${unitPattern})\\s*`, "i");
  const unitMatch = trimmedText.match(unitRegex);

  if (unitMatch) {
    const matchedUnit = unitMatch[1].toLowerCase();
    const normalizedUnit = UNIT_NORMALIZATIONS[matchedUnit] || matchedUnit;
    return {
      unit: normalizedUnit,
      remainingText: trimmedText.substring(unitMatch[0].length),
    };
  }

  // Check for "of" pattern (e.g., "cup of")
  const ofMatch = trimmedText.match(/^of\s+/i);
  if (ofMatch) {
    return {
      unit: null,
      remainingText: trimmedText.substring(ofMatch[0].length),
    };
  }

  return {
    unit: null,
    remainingText: trimmedText,
  };
}

/**
 * Extract preparation notes from ingredient text
 */
function extractPreparation(text: string): {
  name: string;
  preparation: string | null;
} {
  // Check for comma-separated preparation
  const commaMatch = text.match(/^(.+?),\s*(.+)$/);
  if (commaMatch) {
    const [, name, prep] = commaMatch;
    return {
      name: name.trim(),
      preparation: prep.trim(),
    };
  }

  // Check for parenthetical preparation
  const parenMatch = text.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (parenMatch) {
    const [, name, prep] = parenMatch;
    return {
      name: name.trim(),
      preparation: prep.trim(),
    };
  }

  // Check for preparation words in the ingredient name
  const words = text.trim().split(/\s+/);
  const prepWords: string[] = [];
  const nameWords: string[] = [];

  let foundPrep = false;
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (PREPARATION_PATTERNS.includes(word.toLowerCase()) && !foundPrep) {
      prepWords.unshift(word);
      foundPrep = true;
    } else if (foundPrep) {
      // Once we've found a prep word, continue collecting prep words
      // until we hit a non-prep word
      if (PREPARATION_PATTERNS.includes(word.toLowerCase())) {
        prepWords.unshift(word);
      } else {
        // Add remaining words to name
        nameWords.push(...words.slice(0, i + 1));
        break;
      }
    } else {
      nameWords.unshift(word);
    }
  }

  if (prepWords.length > 0 && nameWords.length > 0) {
    return {
      name: nameWords.join(" "),
      preparation: prepWords.join(" "),
    };
  }

  return {
    name: text.trim(),
    preparation: null,
  };
}

/**
 * Main function to parse an ingredient string
 */
export function parseIngredient(ingredientText: string): ParsedIngredient {
  const errors: string[] = [];
  let confidence = 1.0;

  // Clean the input
  const cleanedText = ingredientText
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  if (!cleanedText) {
    errors.push("Empty ingredient text");
    return {
      originalText: ingredientText,
      quantity: null,
      unit: null,
      name: "",
      preparation: null,
      confidence: 0,
      errors,
    };
  }

  // Parse quantity
  const { quantity, remainingText: afterQuantity } = parseQuantity(cleanedText);
  if (quantity === null) {
    confidence *= 0.9; // Slight confidence reduction for missing quantity
  }

  // Parse unit
  const { unit, remainingText: afterUnit } = parseUnit(afterQuantity);
  if (unit === null && quantity !== null) {
    confidence *= 0.95; // Slight confidence reduction for missing unit when quantity exists
  }

  // Extract preparation and name
  const { name, preparation } = extractPreparation(afterUnit);

  // Validate results
  if (!name) {
    errors.push("Could not extract ingredient name");
    confidence = 0;
  }

  // Additional validation
  if (name.length < 2) {
    errors.push("Ingredient name too short");
    confidence *= 0.5;
  }

  // Check if the name seems to contain quantity/unit info (parsing might have failed)
  const suspiciousPatterns = /^\d+|\b(cup|tsp|tbsp|oz|lb|g|kg)\b/i;
  if (suspiciousPatterns.test(name)) {
    errors.push("Ingredient name may contain unparsed quantity or unit");
    confidence *= 0.7;
  }

  return {
    originalText: ingredientText,
    quantity,
    unit,
    name,
    preparation,
    confidence,
    errors,
  };
}

/**
 * Parse multiple ingredients at once
 */
export function parseIngredients(
  ingredientTexts: string[]
): ParsedIngredient[] {
  return ingredientTexts.map(parseIngredient);
}

/**
 * Utility function to format parsed ingredient back to string
 */
export function formatParsedIngredient(parsed: ParsedIngredient): string {
  const parts: string[] = [];

  if (parsed.quantity !== null) {
    parts.push(parsed.quantity.toString());
  }

  if (parsed.unit) {
    parts.push(parsed.unit);
  }

  parts.push(parsed.name);

  if (parsed.preparation) {
    parts.push(`, ${parsed.preparation}`);
  }

  return parts.join(" ");
}
