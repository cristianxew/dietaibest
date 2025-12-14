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
  // English - Weight
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

  // English - Volume
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

  // English - Count/pieces
  piece: "piece",
  pieces: "piece",
  pc: "piece",
  pcs: "piece",
  whole: "piece",
  item: "piece",
  items: "piece",
  unit: "piece",
  units: "piece",

  // English - Special
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

  // Spanish - Weight
  gramo: "g",
  gramos: "g",
  kilogramo: "kg",
  kilogramos: "kg",
  libra: "lb",
  libras: "lb",
  onza: "oz",
  onzas: "oz",

  // Spanish - Volume
  taza: "cup",
  tazas: "cup",
  cucharada: "tbsp",
  cucharadas: "tbsp",
  cucharadita: "tsp",
  cucharaditas: "tsp",
  mililitro: "ml",
  mililitros: "ml",
  litro: "l",
  litros: "l",

  // Spanish - Count/pieces
  pieza: "piece",
  piezas: "piece",
  unidad: "piece",
  unidades: "piece",
  entero: "piece",
  enteros: "piece",

  // Spanish - Special
  lata: "can",
  latas: "can",
  paquete: "package",
  paquetes: "package",
  caja: "box",
  cajas: "box",
  manojo: "bunch",
  manojos: "bunch",
  diente: "clove",
  dientes: "clove",
  rebanada: "slice",
  rebanadas: "slice",
  pizca: "pinch",
  pizcas: "pinch",

  // Polish - Weight
  gramy: "g",
  gramów: "g",
  kilogramy: "kg",
  kilogramów: "kg",
  funt: "lb",
  funty: "lb",
  funtów: "lb",
  uncja: "oz",
  uncje: "oz",
  uncji: "oz",

  // Polish - Volume
  szklanka: "cup",
  szklanki: "cup",
  szklanek: "cup",
  łyżka: "tbsp",
  łyżki: "tbsp",
  łyżek: "tbsp",
  łyżeczka: "tsp",
  łyżeczki: "tsp",
  łyżeczek: "tsp",
  mililitr: "ml",
  mililitry: "ml",
  mililitrów: "ml",
  litr: "l",
  litry: "l",
  litrów: "l",

  // Polish - Count/pieces
  sztuka: "piece",
  sztuki: "piece",
  sztuk: "piece",
  kawałek: "piece",
  kawałki: "piece",
  kawałków: "piece",
  całość: "piece",

  // Polish - Special
  puszka: "can",
  puszki: "can",
  puszek: "can",
  opakowanie: "package",
  opakowania: "package",
  opakowań: "package",
  pudełko: "box",
  pudełka: "box",
  pudełek: "box",
  pęczek: "bunch",
  pęczki: "bunch",
  pęczków: "bunch",
  ząbek: "clove",
  ząbki: "clove",
  ząbków: "clove",
  plaster: "slice",
  plastry: "slice",
  plastrów: "slice",
  szczypta: "pinch",
  szczyptę: "pinch",
  szczypty: "pinch",
  szczypt: "pinch",
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

// ============================================================================
// Unit Conversion System
// ============================================================================

/**
 * Unit type classification for consolidation
 */
export type UnitType = "volume" | "weight" | "count" | "other";

/**
 * Volume units converted to milliliters (ml)
 */
export const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  cup: 236.588,
  tbsp: 14.787,
  tsp: 4.929,
  "fl oz": 29.574,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
};

/**
 * Weight units converted to grams (g)
 */
export const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

/**
 * Units that represent countable items (not convertible to volume/weight)
 */
export const COUNT_UNITS: string[] = [
  "piece",
  "clove",
  "slice",
  "can",
  "package",
  "bunch",
  "box",
  "pinch",
  "dash",
];

/**
 * Determine the type of a unit for consolidation purposes
 *
 * @param unit - Normalized unit string
 * @returns The unit type classification
 */
export function getUnitType(unit: string): UnitType {
  const normalizedUnit = normalizeUnit(unit);

  if (VOLUME_TO_ML[normalizedUnit] !== undefined) {
    return "volume";
  }
  if (WEIGHT_TO_G[normalizedUnit] !== undefined) {
    return "weight";
  }
  if (COUNT_UNITS.includes(normalizedUnit)) {
    return "count";
  }
  return "other";
}

/**
 * Convert an amount to base units (ml for volume, g for weight)
 *
 * @param amount - The amount to convert
 * @param unit - The unit of the amount
 * @returns The amount in base units, or null if conversion not possible
 */
export function convertToBaseUnit(
  amount: number,
  unit: string
): { amount: number; baseUnit: "ml" | "g" } | null {
  const normalizedUnit = normalizeUnit(unit);
  const unitType = getUnitType(normalizedUnit);

  if (unitType === "volume") {
    const factor = VOLUME_TO_ML[normalizedUnit];
    if (factor !== undefined) {
      return { amount: amount * factor, baseUnit: "ml" };
    }
  }

  if (unitType === "weight") {
    const factor = WEIGHT_TO_G[normalizedUnit];
    if (factor !== undefined) {
      return { amount: amount * factor, baseUnit: "g" };
    }
  }

  return null;
}

/**
 * Convert an amount from base units to a target unit
 *
 * @param amount - The amount in base units (ml or g)
 * @param baseUnit - The base unit ('ml' or 'g')
 * @param targetUnit - The target unit to convert to
 * @returns The converted amount, or null if conversion not possible
 */
export function convertFromBaseUnit(
  amount: number,
  baseUnit: "ml" | "g",
  targetUnit: string
): number | null {
  const normalizedTarget = normalizeUnit(targetUnit);

  if (baseUnit === "ml") {
    const factor = VOLUME_TO_ML[normalizedTarget];
    if (factor !== undefined) {
      return amount / factor;
    }
  }

  if (baseUnit === "g") {
    const factor = WEIGHT_TO_G[normalizedTarget];
    if (factor !== undefined) {
      return amount / factor;
    }
  }

  return null;
}

/**
 * Select the best display unit based on the amount
 * Chooses user-friendly units (e.g., cups instead of ml for cooking)
 *
 * @param baseAmount - The amount in base units (ml or g)
 * @param unitType - The unit type ('volume' or 'weight')
 * @returns The best display unit and converted amount
 */
export function getBestDisplayUnit(
  baseAmount: number,
  unitType: "volume" | "weight"
): { amount: number; unit: string } {
  if (unitType === "volume") {
    // For very small amounts, use tsp
    if (baseAmount < 15) {
      return {
        amount: Math.round((baseAmount / VOLUME_TO_ML.tsp) * 100) / 100,
        unit: "tsp",
      };
    }
    // For small amounts, use tbsp
    if (baseAmount < 60) {
      return {
        amount: Math.round((baseAmount / VOLUME_TO_ML.tbsp) * 100) / 100,
        unit: "tbsp",
      };
    }
    // For medium amounts, use cups
    if (baseAmount < 1500) {
      return {
        amount: Math.round((baseAmount / VOLUME_TO_ML.cup) * 100) / 100,
        unit: "cup",
      };
    }
    // For large amounts, use liters
    return {
      amount: Math.round((baseAmount / VOLUME_TO_ML.l) * 100) / 100,
      unit: "l",
    };
  }

  if (unitType === "weight") {
    // For amounts under 1kg, use grams
    if (baseAmount < 1000) {
      return {
        amount: Math.round(baseAmount * 100) / 100,
        unit: "g",
      };
    }
    // For larger amounts, use kg
    return {
      amount: Math.round((baseAmount / WEIGHT_TO_G.kg) * 100) / 100,
      unit: "kg",
    };
  }

  // Fallback (shouldn't reach here)
  return { amount: baseAmount, unit: "g" };
}
