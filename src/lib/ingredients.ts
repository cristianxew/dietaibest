/**
 * Ingredient Parser with Heuristics
 * Parses natural language ingredient lines into structured data
 *
 * @module lib/ingredients
 */

/**
 * Parsed ingredient structure
 */
export interface ParsedIngredient {
  /** Original ingredient line */
  original: string;
  /** Normalized ingredient name */
  name: string;
  /** Quantity/amount */
  qty: number;
  /** Normalized unit */
  unit: string;
}

/**
 * Unicode and ASCII fraction mappings
 */
export const FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 0.333,
  "⅔": 0.667,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
  "⅕": 0.2,
  "⅖": 0.4,
  "⅗": 0.6,
  "⅘": 0.8,
  "⅙": 0.167,
  "⅚": 0.833,
};

/**
 * Unit aliases and variations mapped to normalized forms
 */
export const UNIT_ALIASES: Record<string, string> = {
  // Weight
  gram: "g",
  grams: "g",
  gr: "g",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",

  // Volume
  cup: "cup",
  cups: "cup",
  c: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbsp: "tbsp",
  tbs: "tbsp",
  tbl: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tsp: "tsp",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  pint: "pint",
  pints: "pint",
  quart: "quart",
  quarts: "quart",
  gallon: "gallon",
  gallons: "gallon",
  "fluid ounce": "fl oz",
  "fluid ounces": "fl oz",
  "fl oz": "fl oz",
  "fl. oz": "fl oz",

  // Count/pieces
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  whole: "piece",
  item: "piece",
  items: "piece",
  unit: "piece",
  units: "piece",

  // Special
  can: "can",
  cans: "can",
  package: "package",
  packages: "package",
  pkg: "package",
  box: "box",
  boxes: "box",
  bunch: "bunch",
  bunches: "bunch",
  clove: "clove",
  cloves: "clove",
  slice: "slice",
  slices: "slice",
  pinch: "pinch",
  pinches: "pinch",
  dash: "dash",
  dashes: "dash",
};

/**
 * State/preparation words to strip from ingredient names
 * These don't affect identification but describe processing
 */
export const STATE_WORDS = [
  "chopped",
  "diced",
  "minced",
  "sliced",
  "grated",
  "shredded",
  "crushed",
  "ground",
  "whole",
  "halved",
  "quartered",
  "cubed",
  "julienned",
  "peeled",
  "seeded",
  "deveined",
  "boneless",
  "skinless",
  "raw",
  "cooked",
  "boiled",
  "roasted",
  "grilled",
  "fried",
  "baked",
  "steamed",
  "sautéed",
  "blanched",
  "fresh",
  "frozen",
  "dried",
  "canned",
  "toasted",
  "melted",
  "softened",
  "beaten",
  "whisked",
  "sifted",
  "packed",
  "unpacked",
  "lightly",
  "firmly",
  "finely",
  "coarsely",
  "thinly",
  "thickly",
  "large",
  "medium",
  "small",
  "extra",
  "optional",
  "to taste",
  "as needed",
];

/**
 * Ingredient synonyms for normalization
 * Maps regional/alternative names to standard names
 */
export const SYNONYMS: Record<string, string> = {
  // British to American
  aubergine: "eggplant",
  courgette: "zucchini",
  coriander: "cilantro",
  rocket: "arugula",
  "spring onion": "scallion",
  "spring onions": "scallions",

  // Common variations
  garbanzo: "chickpea",
  garbanzos: "chickpeas",
  "garbanzo bean": "chickpea",
  "garbanzo beans": "chickpeas",
  scallion: "green onion",
  scallions: "green onions",

  // Simplified names
  "extra virgin olive oil": "olive oil",
  "extra-virgin olive oil": "olive oil",
  "kosher salt": "salt",
  "sea salt": "salt",
  "table salt": "salt",
  "black pepper": "pepper",
  "white pepper": "pepper",
  "ground black pepper": "pepper",
  "freshly ground pepper": "pepper",
};

/**
 * Density fallbacks for common ingredients (grams per unit)
 * Used when USDA portions don't have the specific unit
 */
export const DENSITY_FALLBACK_G_PER_UNIT: Record<
  string,
  Record<string, number>
> = {
  onion: {
    cup: 160,
    tbsp: 10,
    tsp: 3.3,
    piece: 150,
  },
  "green onion": {
    cup: 100,
    tbsp: 6,
    piece: 15,
  },
  garlic: {
    clove: 3,
    tbsp: 8.5,
    tsp: 2.8,
  },
  tomato: {
    cup: 180,
    piece: 123,
  },
  potato: {
    cup: 150,
    piece: 213,
  },
  carrot: {
    cup: 128,
    piece: 61,
  },
  "bell pepper": {
    cup: 149,
    piece: 119,
  },
  cucumber: {
    cup: 104,
    piece: 301,
  },
  "chicken breast": {
    cup: 140,
    piece: 174,
    oz: 28.35,
    lb: 453.6,
  },
  "ground beef": {
    cup: 225,
    oz: 28.35,
    lb: 453.6,
  },
  rice: {
    cup: 185, // cooked
    oz: 28.35,
  },
  "rice cooked": {
    cup: 158,
  },
  "rice uncooked": {
    cup: 185,
  },
  pasta: {
    cup: 140, // cooked
    oz: 28.35,
  },
  flour: {
    cup: 120,
    tbsp: 7.5,
    tsp: 2.5,
  },
  sugar: {
    cup: 200,
    tbsp: 12.5,
    tsp: 4.2,
  },
  "brown sugar": {
    cup: 220,
    tbsp: 14,
    tsp: 4.6,
  },
  butter: {
    cup: 227,
    tbsp: 14,
    tsp: 4.7,
    stick: 113,
  },
  "olive oil": {
    cup: 216,
    tbsp: 13.5,
    tsp: 4.5,
  },
  oil: {
    cup: 216,
    tbsp: 13.5,
    tsp: 4.5,
  },
  milk: {
    cup: 244,
    tbsp: 15,
    tsp: 5,
  },
  water: {
    cup: 237,
    tbsp: 15,
    tsp: 5,
    ml: 1,
    l: 1000,
  },
  salt: {
    tbsp: 18,
    tsp: 6,
    pinch: 0.36,
  },
  pepper: {
    tbsp: 6.9,
    tsp: 2.3,
    pinch: 0.14,
  },
};

/**
 * Parse a numeric string that may contain fractions
 * Handles: "1", "1.5", "1 1/2", "1½", "½"
 *
 * @param str - String to parse
 * @returns Numeric value
 */
export function toNumber(str: string): number {
  str = str.trim();

  // Check for unicode fractions
  for (const [frac, val] of Object.entries(FRACTIONS)) {
    if (str.includes(frac)) {
      const parts = str.split(frac);
      const whole = parts[0].trim() ? parseFloat(parts[0]) : 0;
      return whole + val;
    }
  }

  // Check for ASCII fractions like "1/2"
  const fracMatch = str.match(/^(\d*)\s*(\d+)\/(\d+)$/);
  if (fracMatch) {
    const whole = fracMatch[1] ? parseFloat(fracMatch[1]) : 0;
    const num = parseFloat(fracMatch[2]);
    const denom = parseFloat(fracMatch[3]);
    return whole + num / denom;
  }

  // Handle space-separated mixed numbers like "1 1/2"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const num = parseFloat(mixedMatch[2]);
    const denom = parseFloat(mixedMatch[3]);
    return whole + num / denom;
  }

  // Simple decimal or integer
  const val = parseFloat(str);
  return isNaN(val) ? 1 : val;
}

/**
 * Normalize unit variations to standard forms
 *
 * @param unit - Unit string to normalize
 * @returns Normalized unit
 */
export function normalizeUnit(unit: string): string {
  const cleaned = unit.toLowerCase().trim().replace(/\.$/, ""); // remove trailing period
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

/**
 * Strip state/preparation words from ingredient name
 *
 * @param name - Ingredient name
 * @returns Cleaned name without state words
 */
function stripStateWords(name: string): string {
  let result = name;
  for (const word of STATE_WORDS) {
    // Use word boundaries to avoid partial matches
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, "");
  }
  return result.replace(/\s+/g, " ").trim();
}

/**
 * Apply synonym substitutions to ingredient name
 *
 * @param name - Ingredient name
 * @returns Name with synonyms applied
 */
function applySynonyms(name: string): string {
  const lower = name.toLowerCase();
  for (const [synonym, standard] of Object.entries(SYNONYMS)) {
    if (lower.includes(synonym)) {
      return standard;
    }
  }
  return name;
}

/**
 * Parse an ingredient line into structured data
 * Handles various formats:
 * - "2 cups chopped onions"
 * - "1½ tbsp olive oil"
 * - "3 cloves garlic, minced"
 * - "Salt to taste"
 * - "chicken breast 200g"
 *
 * @param line - Ingredient line to parse
 * @returns Parsed ingredient object
 */
export function parseIngredientLine(line: string): ParsedIngredient {
  const original = line;
  let cleaned = line.trim();

  // Remove parenthetical notes: "onions (yellow)" -> "onions"
  cleaned = cleaned.replace(/\([^)]*\)/g, "");

  // Remove notes after commas or dashes: "garlic, minced" -> "garlic"
  if (cleaned.includes(",")) {
    cleaned = cleaned.split(",")[0].trim();
  }
  if (cleaned.includes(" - ")) {
    cleaned = cleaned.split(" - ")[0].trim();
  }

  // Pattern 1: "<qty> <unit> <name...>"
  // Matches: "2 cups onions", "1.5 tbsp oil", "3 g salt"
  const pattern1 = /^([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚\s/.]+)\s+([a-zA-Z]+\.?)\s+(.+)$/;
  const match1 = cleaned.match(pattern1);

  if (match1) {
    const qty = toNumber(match1[1]);
    const unit = normalizeUnit(match1[2]);
    let name = match1[3].toLowerCase();
    name = stripStateWords(name);
    name = applySynonyms(name);
    name = name.trim();

    return { original, name, qty, unit };
  }

  // Pattern 2: "<name...> <qty> <unit>"
  // Matches: "onions 2 cups", "olive oil 50ml"
  const pattern2 = /^(.+?)\s+([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚\s/.]+)\s*([a-zA-Z]+\.?)$/;
  const match2 = cleaned.match(pattern2);

  if (match2) {
    const qty = toNumber(match2[2]);
    const unit = normalizeUnit(match2[3]);
    let name = match2[1].toLowerCase();
    name = stripStateWords(name);
    name = applySynonyms(name);
    name = name.trim();

    return { original, name, qty, unit };
  }

  // Pattern 3: "<qty> <name...>" (no unit, default to piece)
  // Matches: "2 onions", "3 eggs"
  const pattern3 = /^([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚\s/.]+)\s+(.+)$/;
  const match3 = cleaned.match(pattern3);

  if (match3) {
    const qty = toNumber(match3[1]);
    let name = match3[2].toLowerCase();
    name = stripStateWords(name);
    name = applySynonyms(name);
    name = name.trim();

    return { original, name, qty, unit: "piece" };
  }

  // Fallback: No quantity found, treat as single piece
  let name = cleaned.toLowerCase();
  name = stripStateWords(name);
  name = applySynonyms(name);
  name = name.trim();

  return { original, name, qty: 1, unit: "piece" };
}
