/**
 * Synonym Translation Layer for Edamam API
 *
 * Translates Polish (PL) and Spanish (ES) ingredient names and units to English
 * before sending to Edamam API to improve recognition accuracy.
 */

// ============================================================================
// Spanish → English Ingredient Synonyms
// ============================================================================

const SPANISH_INGREDIENTS: Record<string, string> = {
  // Proteins
  pollo: "chicken",
  carne: "beef",
  cerdo: "pork",
  pescado: "fish",
  salmón: "salmon",
  atún: "tuna",
  camarón: "shrimp",
  camarones: "shrimp",
  huevo: "egg",
  huevos: "eggs",

  // Dairy
  leche: "milk",
  queso: "cheese",
  yogur: "yogurt",
  mantequilla: "butter",
  crema: "cream",
  nata: "cream",

  // Vegetables
  tomate: "tomato",
  tomates: "tomatoes",
  cebolla: "onion",
  cebollas: "onions",
  ajo: "garlic",
  zanahoria: "carrot",
  zanahorias: "carrots",
  papa: "potato",
  papas: "potatoes",
  patata: "potato",
  patatas: "potatoes",
  lechuga: "lettuce",
  espinaca: "spinach",
  espinacas: "spinach",
  pimiento: "bell pepper",
  pimientos: "bell peppers",
  chile: "chili pepper",
  calabacín: "zucchini",
  berenjena: "eggplant",
  brócoli: "broccoli",
  coliflor: "cauliflower",

  // Fruits
  manzana: "apple",
  manzanas: "apples",
  plátano: "banana",
  plátanos: "bananas",
  naranja: "orange",
  naranjas: "oranges",
  limón: "lemon",
  limones: "lemons",
  fresa: "strawberry",
  fresas: "strawberries",
  uva: "grape",
  uvas: "grapes",
  sandía: "watermelon",
  melón: "melon",

  // Grains & Legumes
  arroz: "rice",
  pasta: "pasta",
  pan: "bread",
  harina: "flour",
  frijoles: "beans",
  lentejas: "lentils",
  garbanzos: "chickpeas",
  maíz: "corn",
  avena: "oats",

  // Condiments & Spices
  sal: "salt",
  pimienta: "pepper",
  azúcar: "sugar",
  aceite: "oil",
  vinagre: "vinegar",
  canela: "cinnamon",
  comino: "cumin",
  orégano: "oregano",
  perejil: "parsley",
  cilantro: "cilantro",

  // Common words
  fresco: "fresh",
  fresca: "fresh",
  cocido: "cooked",
  cocida: "cooked",
  crudo: "raw",
  cruda: "raw",
  picado: "chopped",
  picada: "chopped",
  rallado: "grated",
  rallada: "grated",
};

// ============================================================================
// Polish → English Ingredient Synonyms
// ============================================================================

const POLISH_INGREDIENTS: Record<string, string> = {
  // Proteins
  kurczak: "chicken",
  wołowina: "beef",
  wieprzowina: "pork",
  ryba: "fish",
  łosoś: "salmon",
  tuńczyk: "tuna",
  krewetka: "shrimp",
  krewetki: "shrimp",
  jajko: "egg",
  jajka: "eggs",

  // Dairy
  mleko: "milk",
  ser: "cheese",
  jogurt: "yogurt",
  masło: "butter",
  śmietana: "cream",

  // Vegetables
  pomidor: "tomato",
  pomidory: "tomatoes",
  cebula: "onion",
  cebule: "onions",
  czosnek: "garlic",
  marchew: "carrot",
  marchewka: "carrot",
  ziemniak: "potato",
  ziemniaki: "potatoes",
  sałata: "lettuce",
  szpinak: "spinach",
  papryka: "bell pepper",
  papryki: "bell peppers",
  cukinia: "zucchini",
  bakłażan: "eggplant",
  brokuły: "broccoli",
  kalafior: "cauliflower",

  // Fruits
  jabłko: "apple",
  jabłka: "apples",
  banan: "banana",
  banany: "bananas",
  pomarańcza: "orange",
  pomarańcze: "oranges",
  cytryna: "lemon",
  cytryny: "lemons",
  truskawka: "strawberry",
  truskawki: "strawberries",
  winogrono: "grape",
  winogrona: "grapes",
  arbuz: "watermelon",
  melon: "melon",

  // Grains & Legumes
  ryż: "rice",
  makaron: "pasta",
  chleb: "bread",
  mąka: "flour",
  fasola: "beans",
  soczewica: "lentils",
  ciecierzyca: "chickpeas",
  kukurydza: "corn",
  owies: "oats",
  płatki: "oats",

  // Condiments & Spices
  sól: "salt",
  pieprz: "pepper",
  cukier: "sugar",
  olej: "oil",
  ocet: "vinegar",
  cynamon: "cinnamon",
  kminek: "cumin",
  oregano: "oregano",
  pietruszka: "parsley",

  // Common words
  świeży: "fresh",
  świeża: "fresh",
  gotowany: "cooked",
  gotowana: "cooked",
  surowy: "raw",
  surowa: "raw",
  posiekany: "chopped",
  posiekana: "chopped",
  tarty: "grated",
  tarta: "grated",
};

// ============================================================================
// Unit Conversions
// ============================================================================

const SPANISH_UNITS: Record<string, string> = {
  // Volume
  taza: "cup",
  tazas: "cups",
  cucharada: "tablespoon",
  cucharadas: "tablespoons",
  cucharadita: "teaspoon",
  cucharaditas: "teaspoons",
  litro: "liter",
  litros: "liters",
  mililitro: "milliliter",
  mililitros: "milliliters",
  ml: "ml",

  // Weight
  gramo: "gram",
  gramos: "grams",
  kilogramo: "kilogram",
  kilogramos: "kilograms",
  kg: "kg",
  g: "g",
  libra: "pound",
  libras: "pounds",
  onza: "ounce",
  onzas: "ounces",

  // Other
  pizca: "pinch",
  puñado: "handful",
  diente: "clove",
  dientes: "cloves",
  rebanada: "slice",
  rebanadas: "slices",
  rodaja: "slice",
  rodajas: "slices",
  trozo: "piece",
  trozos: "pieces",
  unidad: "piece",
  unidades: "pieces",
};

const POLISH_UNITS: Record<string, string> = {
  // Volume
  szklanka: "cup",
  szklanki: "cups",
  łyżka: "tablespoon",
  łyżki: "tablespoons",
  łyżeczka: "teaspoon",
  łyżeczki: "teaspoons",
  litr: "liter",
  litry: "liters",
  mililitr: "milliliter",
  mililitry: "milliliters",
  ml: "ml",

  // Weight
  gram: "gram",
  gramy: "grams",
  gramów: "grams",
  kilogram: "kilogram",
  kilogramy: "kilograms",
  kg: "kg",
  g: "g",

  // Other
  szczypta: "pinch",
  garść: "handful",
  ząbek: "clove",
  ząbki: "cloves",
  plaster: "slice",
  plastry: "slices",
  kawałek: "piece",
  kawałki: "pieces",
  sztuka: "piece",
  sztuki: "pieces",
};

// ============================================================================
// Translation Functions
// ============================================================================

/**
 * Detect language of ingredient text (simple heuristic)
 */
function detectLanguage(text: string): "es" | "pl" | "en" {
  const lowerText = text.toLowerCase();

  // Check for Spanish-specific characters and common words
  const spanishIndicators = /[áéíóúñ]|pollo|carne|tomate|cebolla|arroz/;
  if (spanishIndicators.test(lowerText)) {
    return "es";
  }

  // Check for Polish-specific characters and common words
  const polishIndicators = /[ąćęłńóśźż]|kurczak|ziemniak|mleko|chleb/;
  if (polishIndicators.test(lowerText)) {
    return "pl";
  }

  return "en";
}

/**
 * Translate a single word using the appropriate dictionary
 */
function translateWord(word: string, language: "es" | "pl"): string {
  const lowerWord = word.toLowerCase();

  if (language === "es") {
    return SPANISH_INGREDIENTS[lowerWord] || SPANISH_UNITS[lowerWord] || word;
  } else if (language === "pl") {
    return POLISH_INGREDIENTS[lowerWord] || POLISH_UNITS[lowerWord] || word;
  }

  return word;
}

/**
 * Translate ingredient line from PL/ES to EN
 */
export function translateIngredient(ingredient: string): string {
  const language = detectLanguage(ingredient);

  if (language === "en") {
    return ingredient; // Already in English
  }

  // Split into words and translate each
  const words = ingredient.split(/\s+/);
  const translatedWords = words.map((word) => {
    // Preserve numbers and punctuation
    if (/^[\d.,\/\-]+$/.test(word)) {
      return word;
    }

    // Translate word
    const translated = translateWord(word, language);

    // Preserve capitalization pattern
    if (word[0] === word[0].toUpperCase()) {
      return translated.charAt(0).toUpperCase() + translated.slice(1);
    }

    return translated;
  });

  return translatedWords.join(" ");
}

/**
 * Translate array of ingredient lines
 */
export function translateIngredients(ingredients: string[]): string[] {
  return ingredients.map(translateIngredient);
}

/**
 * Normalize ingredient text for better Edamam recognition
 * - Removes extra whitespace
 * - Standardizes fractions
 * - Expands abbreviations
 */
export function normalizeIngredient(ingredient: string): string {
  let normalized = ingredient.trim();

  // Standardize fractions
  normalized = normalized.replace(/½/g, "1/2");
  normalized = normalized.replace(/⅓/g, "1/3");
  normalized = normalized.replace(/⅔/g, "2/3");
  normalized = normalized.replace(/¼/g, "1/4");
  normalized = normalized.replace(/¾/g, "3/4");
  normalized = normalized.replace(/⅛/g, "1/8");

  // Expand common abbreviations
  normalized = normalized.replace(/\btsp\b/gi, "teaspoon");
  normalized = normalized.replace(/\btbsp\b/gi, "tablespoon");
  normalized = normalized.replace(/\boz\b/gi, "ounce");
  normalized = normalized.replace(/\blb\b/gi, "pound");

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, " ");

  return normalized;
}

/**
 * Full processing pipeline: translate + normalize
 */
export function processIngredientForEdamam(ingredient: string): string {
  const translated = translateIngredient(ingredient);
  return normalizeIngredient(translated);
}

/**
 * Process array of ingredients
 */
export function processIngredientsForEdamam(ingredients: string[]): string[] {
  return ingredients.map(processIngredientForEdamam);
}
