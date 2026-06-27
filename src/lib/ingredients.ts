/**
 * Ingredient Parser with Heuristics
 * Parses natural language ingredient lines into structured data
 *
 * @module lib/ingredients
 */

import { normalizeUnit, getUnitDefinition } from "./unit-registry";

export { normalizeUnit };

/**
 * Structured ingredient as stored in `Recipe.ingredients` (Json?).
 * Persisted by the recipe form; consumed by nutrition orchestration.
 */
export interface StructuredIngredient {
  name?: string;
  amount?: string | number;
  unit?: string;
}

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
  // English - British to American
  aubergine: "eggplant",
  courgette: "zucchini",
  coriander: "cilantro",
  rocket: "arugula",
  "spring onion": "scallion",
  "spring onions": "scallions",

  // English - Common variations
  garbanzo: "chickpea",
  garbanzos: "chickpeas",
  "garbanzo bean": "chickpea",
  "garbanzo beans": "chickpeas",
  scallion: "green onion",
  scallions: "green onions",

  // English - Simplified names
  "extra virgin olive oil": "olive oil",
  "extra-virgin olive oil": "olive oil",
  "kosher salt": "salt",
  "sea salt": "salt",
  "table salt": "salt",
  "black pepper": "pepper",
  "white pepper": "pepper",
  "ground black pepper": "pepper",
  "freshly ground pepper": "pepper",

  // Spanish - Common ingredients
  cebolla: "onion",
  cebollas: "onion",
  pollo: "chicken",
  "pechuga de pollo": "chicken breast",
  "muslo de pollo": "chicken thigh",
  arroz: "rice",
  tomate: "tomato",
  tomates: "tomato",
  jitomate: "tomato",
  jitomates: "tomato",
  ajo: "garlic",
  ajos: "garlic",
  zanahoria: "carrot",
  zanahorias: "carrot",
  papa: "potato",
  papas: "potato",
  patata: "potato",
  patatas: "potato",
  leche: "milk",
  huevo: "egg",
  huevos: "egg",
  pan: "bread",
  aceite: "oil",
  "aceite de oliva": "olive oil",
  sal: "salt",
  azúcar: "sugar",
  harina: "flour",
  mantequilla: "butter",
  queso: "cheese",
  crema: "cream",
  "crema agria": "sour cream",
  yogur: "yogurt",
  yogurt: "yogurt",
  carne: "beef",
  "carne molida": "ground beef",
  "carne de res": "beef",
  cerdo: "pork",
  pescado: "fish",
  salmón: "salmon",
  atún: "tuna",
  camarón: "shrimp",
  camarones: "shrimp",
  gamba: "shrimp",
  gambas: "shrimp",
  lechuga: "lettuce",
  espinaca: "spinach",
  espinacas: "spinach",
  brócoli: "broccoli",
  coliflor: "cauliflower",
  calabacín: "zucchini",
  calabacines: "zucchini",
  berenjena: "eggplant",
  berenjenas: "eggplant",
  pimiento: "bell pepper",
  pimientos: "bell pepper",
  chile: "chili pepper",
  chiles: "chili pepper",
  champiñón: "mushroom",
  champiñones: "mushroom",
  seta: "mushroom",
  setas: "mushroom",
  aguacate: "avocado",
  aguacates: "avocado",
  limón: "lemon",
  limones: "lemon",
  lima: "lime",
  limas: "lime",
  naranja: "orange",
  naranjas: "orange",
  manzana: "apple",
  manzanas: "apple",
  plátano: "banana",
  plátanos: "banana",
  banana: "banana",
  bananas: "banana",
  fresa: "strawberry",
  fresas: "strawberry",
  frutilla: "strawberry",
  frutillas: "strawberry",
  piña: "pineapple",
  ananá: "pineapple",
  uva: "grape",
  uvas: "grape",
  pepino: "cucumber",
  pepinos: "cucumber",
  cilantro: "cilantro",
  perejil: "parsley",
  albahaca: "basil",
  orégano: "oregano",
  comino: "cumin",
  pimienta: "pepper",
  "pimienta negra": "pepper",
  canela: "cinnamon",
  vainilla: "vanilla",
  chocolate: "chocolate",
  cacao: "cocoa",
  café: "coffee",
  té: "tea",
  agua: "water",
  vino: "wine",
  "vino tinto": "red wine",
  "vino blanco": "white wine",
  cerveza: "beer",
  vinagre: "vinegar",
  "vinagre de manzana": "apple cider vinegar",
  mostaza: "mustard",
  mayonesa: "mayonnaise",
  ketchup: "ketchup",
  salsa: "sauce",
  caldo: "broth",
  "caldo de pollo": "chicken broth",
  sopa: "soup",
  pasta: "pasta",
  espagueti: "spaghetti",
  fideo: "noodle",
  fideos: "noodle",
  avena: "oats",
  maíz: "corn",
  frijol: "bean",
  frijoles: "beans",
  judía: "bean",
  judías: "beans",
  lenteja: "lentil",
  lentejas: "lentil",
  nuez: "walnut",
  nueces: "walnut",
  almendra: "almond",
  almendras: "almond",
  maní: "peanut",
  maníes: "peanut",
  cacahuate: "peanut",
  cacahuates: "peanut",
  miel: "honey",
  mermelada: "jam",

  // Polish - Common ingredients
  cebula: "onion",
  cebule: "onion",
  cebuli: "onion",
  kurczak: "chicken",
  "pierś z kurczaka": "chicken breast",
  "filet z kurczaka": "chicken breast",
  "udko z kurczaka": "chicken thigh",
  ryż: "rice",
  pomidor: "tomato",
  pomidory: "tomato",
  pomidorów: "tomato",
  czosnek: "garlic",
  czosnku: "garlic",
  marchew: "carrot",
  marchewka: "carrot",
  marchewki: "carrot",
  marchwi: "carrot",
  ziemniak: "potato",
  ziemniaki: "potato",
  ziemniaków: "potato",
  kartofel: "potato",
  kartofle: "potato",
  mleko: "milk",
  jajko: "egg",
  jajka: "egg",
  jaj: "egg",
  chleb: "bread",
  olej: "oil",
  "oliwa z oliwek": "olive oil",
  oliwa: "olive oil",
  sól: "salt",
  soli: "salt",
  cukier: "sugar",
  cukru: "sugar",
  mąka: "flour",
  mąki: "flour",
  masło: "butter",
  masła: "butter",
  ser: "cheese",
  sera: "cheese",
  śmietana: "cream",
  śmietany: "cream",
  "kwaśna śmietana": "sour cream",
  jogurt: "yogurt",
  jogurtu: "yogurt",
  wołowina: "beef",
  "mielona wołowina": "ground beef",
  "mięso mielone": "ground beef",
  wieprzowina: "pork",
  wieprzowiny: "pork",
  ryba: "fish",
  ryby: "fish",
  łosoś: "salmon",
  łososia: "salmon",
  tuńczyk: "tuna",
  tuńczyka: "tuna",
  krewetka: "shrimp",
  krewetki: "shrimp",
  krewetek: "shrimp",
  sałata: "lettuce",
  sałaty: "lettuce",
  szpinak: "spinach",
  szpinaku: "spinach",
  brokuł: "broccoli",
  brokuły: "broccoli",
  brokułów: "broccoli",
  kalafior: "cauliflower",
  kalafiora: "cauliflower",
  kalafiorów: "cauliflower",
  cukinia: "zucchini",
  cukinii: "zucchini",
  cukinie: "zucchini",
  bakłażan: "eggplant",
  bakłażana: "eggplant",
  bakłażany: "eggplant",
  papryka: "bell pepper",
  papryki: "bell pepper",
  paprykę: "bell pepper",
  "ostra papryka": "chili pepper",
  "papryczka chili": "chili pepper",
  pieczarka: "mushroom",
  pieczarki: "mushroom",
  pieczarek: "mushroom",
  grzyb: "mushroom",
  grzyby: "mushroom",
  grzybów: "mushroom",
  awokado: "avocado",
  cytryna: "lemon",
  cytryny: "lemon",
  cytryn: "lemon",
  limonka: "lime",
  limonki: "lime",
  pomarańcza: "orange",
  pomarańcze: "orange",
  pomarańczy: "orange",
  jabłko: "apple",
  jabłka: "apple",
  jabłek: "apple",
  banan: "banana",
  banany: "banana",
  bananów: "banana",
  truskawka: "strawberry",
  truskawki: "strawberry",
  truskawek: "strawberry",
  ananas: "pineapple",
  ananasa: "pineapple",
  ananasy: "pineapple",
  winogrono: "grape",
  winogrona: "grape",
  winogron: "grape",
  ogórek: "cucumber",
  ogórka: "cucumber",
  ogórki: "cucumber",
  ogórków: "cucumber",
  kolendra: "cilantro",
  kolendry: "cilantro",
  pietruszka: "parsley",
  pietruszki: "parsley",
  bazylia: "basil",
  bazylii: "basil",
  oregano: "oregano",
  kminek: "cumin",
  kminku: "cumin",
  pieprz: "pepper",
  "czarny pieprz": "pepper",
  pieprzu: "pepper",
  cynamon: "cinnamon",
  cynamonu: "cinnamon",
  wanilia: "vanilla",
  wanilii: "vanilla",
  czekolada: "chocolate",
  czekolady: "chocolate",
  kakao: "cocoa",
  kawa: "coffee",
  kawy: "coffee",
  herbata: "tea",
  herbaty: "tea",
  woda: "water",
  wody: "water",
  wino: "wine",
  wina: "wine",
  "czerwone wino": "red wine",
  "białe wino": "white wine",
  piwo: "beer",
  piwa: "beer",
  ocet: "vinegar",
  octu: "vinegar",
  "ocet jabłkowy": "apple cider vinegar",
  musztarda: "mustard",
  musztardy: "mustard",
  majonez: "mayonnaise",
  majonezu: "mayonnaise",
  keczup: "ketchup",
  sos: "sauce",
  sosu: "sauce",
  bulion: "broth",
  bulionu: "broth",
  "bulion drobiowy": "chicken broth",
  "rosół z kurczaka": "chicken broth",
  zupa: "soup",
  zupy: "soup",
  makaron: "pasta",
  makaronu: "pasta",
  spaghetti: "spaghetti",
  kluski: "noodle",
  klusek: "noodle",
  płatki: "oats",
  "płatki owsiane": "oats",
  owies: "oats",
  kukurydza: "corn",
  kukurydzy: "corn",
  fasola: "bean",
  fasoli: "bean",
  fasole: "bean",
  soczewica: "lentil",
  soczewicy: "lentil",
  ciecierzyca: "chickpea",
  ciecierzycy: "chickpea",
  orzech: "walnut",
  orzechy: "walnut",
  orzechów: "walnut",
  "orzech włoski": "walnut",
  migdał: "almond",
  migdały: "almond",
  migdałów: "almond",
  orzeszek: "peanut",
  orzeszki: "peanut",
  "orzeszki ziemne": "peanut",
  miód: "honey",
  miodu: "honey",
  dżem: "jam",
  dżemu: "jam",
  konfitura: "jam",
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

  // --- Sweeteners & syrups ---
  honey: { cup: 340, tbsp: 21, tsp: 7 },
  "maple syrup": { cup: 322, tbsp: 20, tsp: 6.7 },
  "corn syrup": { cup: 328, tbsp: 20.5, tsp: 6.8 },
  molasses: { cup: 337, tbsp: 21, tsp: 7 },
  "powdered sugar": { cup: 120, tbsp: 7.5, tsp: 2.5 },

  // --- Dairy ---
  yogurt: { cup: 245, tbsp: 15.3, tsp: 5.1 },
  "greek yogurt": { cup: 245, tbsp: 15.3 },
  "sour cream": { cup: 230, tbsp: 14, tsp: 4.8 },
  cream: { cup: 240, tbsp: 15, tsp: 5 },
  "heavy cream": { cup: 238, tbsp: 14.9, tsp: 5 },
  "cream cheese": { cup: 232, tbsp: 14.5, tsp: 4.8 },
  cheese: { cup: 113, tbsp: 7, oz: 28.35, slice: 28 },
  cheddar: { cup: 113, tbsp: 7, oz: 28.35, slice: 28 },
  mozzarella: { cup: 112, oz: 28.35, slice: 28 },
  parmesan: { cup: 100, tbsp: 5, tsp: 1.7, oz: 28.35 },
  feta: { cup: 150, oz: 28.35 },

  // --- Baking & dry goods ---
  oats: { cup: 90, tbsp: 5.6 },
  "rolled oats": { cup: 90, tbsp: 5.6 },
  cornmeal: { cup: 122, tbsp: 7.6 },
  cornstarch: { cup: 128, tbsp: 8, tsp: 2.7 },
  "cocoa powder": { cup: 86, tbsp: 5.4, tsp: 1.8 },
  cocoa: { cup: 86, tbsp: 5.4, tsp: 1.8 },
  "almond flour": { cup: 96, tbsp: 6 },
  "whole wheat flour": { cup: 120, tbsp: 7.5 },
  breadcrumbs: { cup: 108, tbsp: 6.75 },
  "bread crumbs": { cup: 108, tbsp: 6.75 },
  "baking powder": { tbsp: 13.8, tsp: 4.6 },
  "baking soda": { tbsp: 13.8, tsp: 4.6 },
  yeast: { tbsp: 9, tsp: 3 },
  vanilla: { tbsp: 13, tsp: 4.2 },
  "vanilla extract": { tbsp: 13, tsp: 4.2 },

  // --- Nuts, seeds & nut butters ---
  almond: { cup: 143, oz: 28.35, tbsp: 9 },
  walnut: { cup: 117, oz: 28.35, tbsp: 7.3 },
  pecan: { cup: 99, oz: 28.35 },
  cashew: { cup: 137, oz: 28.35 },
  peanut: { cup: 146, oz: 28.35 },
  "peanut butter": { cup: 258, tbsp: 16, tsp: 5.3 },
  "almond butter": { cup: 256, tbsp: 16 },
  chia: { tbsp: 12, tsp: 4 },
  "chia seeds": { tbsp: 12, tsp: 4 },
  "sesame seeds": { tbsp: 9, tsp: 3 },
  "sunflower seeds": { cup: 140, tbsp: 9 },

  // --- Legumes & grains (cooked unless noted) ---
  chickpea: { cup: 164, oz: 28.35 },
  bean: { cup: 177, oz: 28.35 },
  "black beans": { cup: 172 },
  "kidney beans": { cup: 177 },
  lentil: { cup: 198 },
  quinoa: { cup: 185 },
  couscous: { cup: 157 },
  corn: { cup: 145 },
  peas: { cup: 145 },

  // --- Condiments & cooking liquids ---
  "soy sauce": { cup: 255, tbsp: 16, tsp: 5.3 },
  vinegar: { cup: 238, tbsp: 15, tsp: 5 },
  "apple cider vinegar": { cup: 238, tbsp: 15, tsp: 5 },
  "lemon juice": { cup: 244, tbsp: 15, tsp: 5 },
  "lime juice": { cup: 244, tbsp: 15, tsp: 5 },
  "orange juice": { cup: 248, tbsp: 15.5 },
  broth: { cup: 240, tbsp: 15 },
  stock: { cup: 240, tbsp: 15 },
  "chicken broth": { cup: 240, tbsp: 15 },
  wine: { cup: 235, tbsp: 14.7 },
  beer: { cup: 237 },
  mayonnaise: { cup: 220, tbsp: 13.8, tsp: 4.6 },
  ketchup: { cup: 240, tbsp: 15, tsp: 5 },
  mustard: { cup: 249, tbsp: 15.6, tsp: 5.2 },
  "tomato sauce": { cup: 245, tbsp: 15.3 },
  "tomato paste": { cup: 262, tbsp: 16.4, tsp: 5.5 },
  "coconut milk": { cup: 240, tbsp: 15 },
  "coconut oil": { cup: 218, tbsp: 13.6, tsp: 4.5 },
  "vegetable oil": { cup: 218, tbsp: 13.6, tsp: 4.5 },
  "canola oil": { cup: 218, tbsp: 13.6, tsp: 4.5 },

  // --- Produce (USDA medium-size piece weights) ---
  egg: { piece: 50, tbsp: 15 },
  apple: { cup: 125, piece: 182 },
  banana: { cup: 150, piece: 118 },
  lemon: { piece: 58 },
  lime: { piece: 67 },
  orange: { piece: 131 },
  avocado: { cup: 150, piece: 150 },
  mushroom: { cup: 70, piece: 18 },
  spinach: { cup: 30 },
  broccoli: { cup: 91, piece: 148 },
  "green beans": { cup: 100 },
  celery: { cup: 101, piece: 40 },
  zucchini: { cup: 124, piece: 196 },
  eggplant: { cup: 82, piece: 458 },
  "sweet potato": { cup: 133, piece: 130 },
  lettuce: { cup: 36 },
  cabbage: { cup: 89 },
  strawberry: { cup: 152, piece: 12 },
  blueberry: { cup: 148 },
  bread: { slice: 28 },
  bacon: { slice: 12 },
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
 * Strip state/preparation words from ingredient name
 *
 * @param name - Ingredient name
 * @returns Cleaned name without state words
 */
export function stripStateWords(name: string): string {
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
export function applySynonyms(name: string): string {
  const lower = name.toLowerCase();
  // Try the most specific (longest) synonym first so multi-word phrases win
  // over their substrings ("aceite de oliva" → "olive oil", not "oil"), and
  // require Unicode letter boundaries so a short key can't be swallowed by a
  // larger word: the old `includes("sal")` turned salmon/salsa/salad into
  // "salt", silently zeroing a very common protein's nutrition.
  const entries = Object.entries(SYNONYMS).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [synonym, standard] of entries) {
    const re = new RegExp(
      `(^|[^\\p{L}])${escapeRegExp(synonym)}([^\\p{L}]|$)`,
      "iu"
    );
    if (re.test(lower)) {
      return standard;
    }
  }
  return name;
}

/** Escape a string for safe interpolation into a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

  // Split an attached quantity+unit so the patterns below see them separately:
  // "200ml milk" -> "200 ml milk", "1tbsp oil" -> "1 tbsp oil". Guarded by the
  // unit registry so ingredient-looking tokens ("7up") and percentages
  // ("100% juice", no leading letters) are left untouched.
  const attached = cleaned.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)\b(.*)$/);
  if (attached && getUnitDefinition(attached[2])) {
    cleaned = `${attached[1]} ${attached[2]}${attached[3]}`;
  }

  // Pattern 1: "<qty> <unit> <name...>"
  // Matches: "2 cups onions", "1.5 tbsp oil", "3 g salt"
  // Unit slot uses \p{L} (any Unicode letter), not [a-zA-Z], so units with
  // diacritics parse — e.g. Polish "łyżka" (tbsp), "łyżeczka" (tsp), "ząbki"
  // (cloves). With [a-zA-Z] these collapsed to a no-unit "piece".
  const pattern1 = /^([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚\s/.]+)\s+(\p{L}+\.?)\s+(.+)$/u;
  const match1 = cleaned.match(pattern1);

  if (match1) {
    const qty = toNumber(match1[1]);
    let unitRaw = match1[2];
    let rest = match1[3];

    // Multi-word unit support (e.g. "fl oz"): if the single token isn't a known
    // unit but token + the next word is, consume that next word into the unit.
    if (!getUnitDefinition(unitRaw)) {
      const m = rest.match(/^(\p{L}+)\s*(.*)$/u);
      if (m && getUnitDefinition(`${unitRaw} ${m[1]}`)) {
        unitRaw = `${unitRaw} ${m[1]}`;
        rest = m[2];
      }
    }

    // Only treat the word after the quantity as a unit when it is a KNOWN unit.
    // Otherwise the line is "<qty> <name…>" — "1 chicken breast", "1 bell
    // pepper", "3 large eggs" — and falls through to pattern 3 below. The old
    // code took ANY word here as the unit, so "chicken"/"bell"/"large" became
    // the unit and the gram ladder collapsed the food to ~1 g.
    if (getUnitDefinition(unitRaw)) {
      const unit = normalizeUnit(unitRaw);
      let name = rest.toLowerCase();
      name = stripStateWords(name);
      name = name.trim();

      return { original, name, qty, unit };
    }
  }

  // Pattern 2: "<name...> <qty> <unit>"
  // Matches: "onions 2 cups", "olive oil 50ml"
  const pattern2 = /^(.+?)\s+([\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘⅙⅚\s/.]+)\s*(\p{L}+\.?)$/u;
  const match2 = cleaned.match(pattern2);

  if (match2) {
    const qty = toNumber(match2[2]);
    const unit = normalizeUnit(match2[3]);
    let name = match2[1].toLowerCase();
    name = stripStateWords(name);
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
    name = name.trim();

    return { original, name, qty, unit: "piece" };
  }

  // Fallback: No quantity found, treat as single piece
  let name = cleaned.toLowerCase();
  name = stripStateWords(name);
  name = name.trim();

  return { original, name, qty: 1, unit: "piece" };
}

// ============================================================================
// Forward direction: structured ingredients → string lines for nutrition APIs
// ============================================================================

function formatOne(item: unknown): string | null {
  if (typeof item === "string") {
    const trimmed = item.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (item && typeof item === "object") {
    const { name, amount, unit } = item as StructuredIngredient;
    if (typeof name !== "string" || name.trim().length === 0) {
      return null;
    }
    const amountStr =
      amount === undefined || amount === null || amount === ""
        ? ""
        : String(amount);
    const unitStr = typeof unit === "string" ? unit : "";
    return [amountStr, unitStr, name].filter((s) => s.length > 0).join(" ").trim();
  }

  return null;
}

/**
 * Format the `Recipe.ingredients` Json value into the string-line shape
 * Edamam (and other nutrition services) expect.
 *
 * Accepts:
 * - an array of strings or `StructuredIngredient` objects (the canonical case),
 * - a single string or object (wrapped into a one-element array),
 * - `null`/`undefined`/anything else (returns `[]`).
 *
 * Skips empty strings, structured items without a name, and non-objects.
 */
export function formatIngredientsForNutrition(ingredients: unknown): string[] {
  if (ingredients === null || ingredients === undefined) {
    return [];
  }

  const list = Array.isArray(ingredients)
    ? ingredients
    : typeof ingredients === "string" || typeof ingredients === "object"
      ? [ingredients]
      : [];

  const lines: string[] = [];
  for (const item of list) {
    const line = formatOne(item);
    if (line !== null) lines.push(line);
  }
  return lines;
}

/**
 * Decide whether two ingredient lists would feed the nutrition engine
 * different inputs — i.e. whether a stored nutrition profile is now stale.
 *
 * Compares the canonical analyzer lines (`formatIngredientsForNutrition`), not
 * the raw objects, so the answer tracks exactly what the FDC engine sees. The
 * comparison is:
 * - **order-independent** — nutrition is a sum, so reordering changes nothing;
 * - **case/whitespace-insensitive** — a cosmetic edit ("Flour" → "flour") must
 *   NOT force a recompute that would overwrite manually-tuned macros.
 *
 * `null`/`undefined`/empty all normalize to "no lines", so a recipe with no
 * ingredients compares equal to another with none.
 */
export function ingredientsChanged(before: unknown, after: unknown): boolean {
  const normalize = (input: unknown): string[] =>
    formatIngredientsForNutrition(input)
      .map((line) => line.toLowerCase().replace(/\s+/g, " ").trim())
      .sort();

  const a = normalize(before);
  const b = normalize(after);

  if (a.length !== b.length) return true;
  return a.some((line, i) => line !== b[i]);
}
