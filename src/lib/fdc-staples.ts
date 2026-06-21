/**
 * Curated staple → canonical USDA FDC id map.
 *
 * Free-text USDA search mis-ranks common staples in ways data-type priority and
 * relevance scoring can't fully fix: "onion" → "DENNY'S onion rings", "banana" →
 * "banana pepper", "egg" → "Egg, creamed", "milk" → a yogurt. For the foods
 * people actually cook with, a hand-picked canonical id beats heuristics.
 *
 * Every id below was verified against the live FDC API (June 2026): it resolves
 * in the `/foods` detail endpoint (some search ids return `{}`) and carries real
 * energy. SR Legacy is preferred — it has the most complete, stable raw/plain
 * forms with reliable energy under nutrient #208.
 *
 * Keys are the NORMALIZED ingredient name the parser emits (lowercased, after
 * `stripStateWords` + `applySynonyms`). ~150 entries spanning proteins, dairy,
 * produce, nuts/seeds, oils, baking goods, legumes, spices, sauces and
 * sweeteners.
 *
 * Deliberately EXCLUDED:
 * - Cup-measured grains with a dry/cooked ambiguity (rice, pasta, oats, quinoa,
 *   couscous) — the density table assumes cooked weights while the USDA staple
 *   is dry, so pinning them would overcount.
 * - Bare "red pepper" — it collides with red bell pepper, so only the
 *   unambiguous *flake* forms map to the cayenne spice.
 *
 * KNOWN LIMITATION: the parser strips "ground" as a state word, so "ground
 * turkey"/"ground beef" normalize to "turkey"/"beef" and resolve to the base
 * cut, never to a dedicated ground-meat key. Recovering that needs a parser
 * change, not a map entry.
 *
 * @module lib/fdc-staples
 */

export const STAPLE_FDC_IDS: Record<string, number> = {
  // --- Proteins (raw, matching how recipes list raw weights) ---
  egg: 171287, // Egg, whole, raw, fresh
  "egg white": 172183, // Egg, white, raw, fresh
  "egg yolk": 172184, // Egg, yolk, raw, fresh
  chicken: 171077, // Chicken, breast, skinless, boneless, meat only, raw
  "chicken breast": 171077,
  "chicken thigh": 172385,
  beef: 170809, // Beef, chuck for stew, lean and fat, raw
  "ground beef": 174036, // Beef, ground, 80% lean / 20% fat, raw
  pork: 168230, // Pork, loin, lean only, raw
  "ground pork": 167902, // Pork, fresh, ground, raw
  bacon: 168277, // Pork, cured, bacon, unprepared
  ham: 173864, // Ham, sliced, regular (~11% fat)
  sausage: 173882, // Pork sausage, cooked
  "pork sausage": 173882,
  turkey: 171098, // Turkey, breast, meat only, raw
  lamb: 174311, // Lamb, leg, whole, lean and fat, raw
  duck: 172410, // Duck, domesticated, meat only, raw
  salmon: 173686, // Fish, salmon, Atlantic, wild, raw
  tuna: 171986, // Fish, tuna, light, canned in water, drained
  tilapia: 175176, // Fish, tilapia, raw
  shrimp: 175179, // Crustaceans, shrimp, raw
  fish: 171955, // Fish, cod, Atlantic, raw
  tofu: 172475, // Tofu, raw, firm (calcium sulfate)

  // --- Dairy ---
  milk: 171265, // Milk, whole, 3.25% milkfat, +vitamin D
  "skim milk": 169868, // Milk, fluid, nonfat (fat free or skim)
  "nonfat milk": 169868,
  "almond milk": 174832, // Beverages, almond milk, unsweetened
  "soy milk": 175215, // Soymilk (all flavors), unsweetened
  soymilk: 175215,
  "oat milk": 2257046, // Oat milk, unsweetened, plain
  butter: 173410, // Butter, salted
  ghee: 173412, // Butter oil, anhydrous (clarified butter / ghee)
  margarine: 172346, // Margarine, regular, 80% fat, stick, salted
  cheese: 170899, // Cheese, cheddar, sharp
  cheddar: 170899,
  "cheddar cheese": 170899,
  mozzarella: 170845, // Cheese, mozzarella, whole milk
  "mozzarella cheese": 170845,
  parmesan: 170848, // Cheese, parmesan, hard
  "parmesan cheese": 170848,
  feta: 173420, // Cheese, feta
  "feta cheese": 173420,
  swiss: 171251, // Cheese, swiss
  "swiss cheese": 171251,
  provolone: 170850, // Cheese, provolone
  "provolone cheese": 170850,
  ricotta: 170851, // Cheese, ricotta, whole milk
  "ricotta cheese": 170851,
  "cottage cheese": 172179, // Cheese, cottage, creamed, large or small curd
  yogurt: 171284, // Yogurt, plain, whole milk
  "greek yogurt": 171304, // Yogurt, Greek, plain, whole milk
  "sour cream": 171257, // Cream, sour, cultured (regular)
  "heavy cream": 170859, // Cream, fluid, heavy whipping
  "half and half": 171255, // Cream, fluid, half and half
  "cream cheese": 173418, // Cheese, cream
  "condensed milk": 171275, // Milk, canned, condensed, sweetened
  "evaporated milk": 172194, // Milk, canned, evaporated

  // --- Produce: vegetables ---
  onion: 170000, // Onions, raw
  "red onion": 170000, // (no SR Legacy red-specific entry; raw onion is close)
  "green onion": 170005, // Onions, spring or scallions, raw
  scallion: 170005,
  garlic: 2709786, // Garlic, raw
  tomato: 170457, // Tomatoes, red, ripe, raw
  carrot: 170393, // Carrots, raw
  "bell pepper": 170108, // Peppers, sweet, red, raw
  "green bell pepper": 170427, // Peppers, sweet, green, raw
  "green pepper": 170427,
  spinach: 168462, // Spinach, raw
  kale: 168421, // Kale, raw
  arugula: 169387, // Arugula, raw
  lettuce: 169247, // Lettuce, cos or romaine, raw
  broccoli: 170379, // Broccoli, raw
  cauliflower: 169986, // Cauliflower, raw
  "brussels sprouts": 170383, // Brussels sprouts, raw
  "brussel sprouts": 170383,
  cucumber: 169225, // Cucumber, peeled, raw
  mushroom: 169251, // Mushrooms, white, raw
  zucchini: 168565, // Squash, zucchini, raw
  "butternut squash": 169295, // Squash, winter, butternut, raw
  pumpkin: 168448, // Pumpkin, raw
  celery: 169988, // Celery, raw
  asparagus: 168389, // Asparagus, raw
  "green beans": 169961, // Beans, snap, green, raw
  "snow peas": 170010, // Peas, edible-podded, raw
  "snap peas": 170010,
  edamame: 168410, // Edamame, frozen, unprepared
  cabbage: 169975, // Cabbage, raw
  eggplant: 169228, // Eggplant, raw
  okra: 169260, // Okra, raw
  beet: 169145, // Beets, raw
  radish: 169276, // Radishes, raw
  turnip: 170465, // Turnips, raw
  leek: 169246, // Leeks, raw
  artichoke: 169205, // Artichokes, raw
  jalapeno: 168576, // Peppers, jalapeno, raw
  "jalapeño": 168576,
  ginger: 169231, // Ginger root, raw
  peas: 170419, // Peas, green, raw
  potato: 170026, // Potatoes, flesh and skin, raw
  "sweet potato": 168482, // Sweet potato, raw, unprepared
  corn: 169998, // Corn, sweet, yellow, raw
  parsley: 170416, // Parsley, fresh
  cilantro: 169997, // Coriander (cilantro) leaves, raw
  basil: 172232, // Basil, fresh
  mint: 173475, // Spearmint, fresh

  // --- Produce: fruit ---
  apple: 168202, // Apples, raw, with skin
  banana: 173944, // Bananas, raw
  orange: 169918, // Oranges, raw
  lemon: 167746, // Lemons, raw, without peel
  lime: 168155, // Limes, raw
  grapefruit: 174675, // Grapefruit, raw, pink and red
  strawberry: 167762, // Strawberries, raw
  blueberry: 171711, // Blueberries, raw
  raspberry: 167755, // Raspberries, raw
  blackberry: 173946, // Blackberries, raw
  cranberry: 171722, // Cranberries, raw
  cherry: 171719, // Cherries, sweet, raw
  avocado: 171707, // Avocados, raw
  grape: 174683, // Grapes, red or green, raw
  pineapple: 169124, // Pineapple, raw
  mango: 169910, // Mangos, raw
  peach: 169928, // Peaches, yellow, raw
  pear: 169118, // Pears, raw
  plum: 169949, // Plums, raw
  apricot: 171697, // Apricots, raw
  watermelon: 167765, // Watermelon, raw
  cantaloupe: 169092, // Melons, cantaloupe, raw
  kiwi: 168153, // Kiwifruit, green, raw
  kiwifruit: 168153,
  pomegranate: 169134, // Pomegranates, raw
  coconut: 170169, // Nuts, coconut meat, raw
  fig: 173021, // Figs, raw
  date: 168191, // Dates, medjool
  raisin: 168165, // Raisins, dark, seedless

  // --- Nuts / seeds / nut butters ---
  almond: 170567, // Nuts, almonds
  walnut: 170187, // Nuts, walnuts, english
  pecan: 170182, // Nuts, pecans
  cashew: 170162, // Nuts, cashew nuts, raw
  pistachio: 170184, // Nuts, pistachio nuts, raw
  hazelnut: 170581, // Nuts, hazelnuts or filberts
  macadamia: 170178, // Nuts, macadamia nuts, raw
  "pine nut": 170591, // Nuts, pine nuts, dried
  peanut: 174263, // Peanuts, raw
  "peanut butter": 174266, // Peanut butter, smooth, with salt
  "almond butter": 168603, // Nuts, almond butter, plain, with salt
  tahini: 168604, // Seeds, sesame butter, tahini
  "sunflower seed": 170562, // Seeds, sunflower seed kernels, dried
  "pumpkin seed": 170556, // Seeds, pumpkin and squash seed kernels, dried
  "chia seed": 170554, // Seeds, chia seeds, dried
  flaxseed: 169414, // Seeds, flaxseed
  "flax seed": 169414,
  "sesame seed": 170150, // Seeds, sesame seeds, whole, dried

  // --- Fats / oils ---
  oil: 172370, // Oil, vegetable, soybean (generic)
  "olive oil": 171413, // Oil, olive, salad or cooking
  "vegetable oil": 172370,
  "coconut oil": 171412, // Oil, coconut
  "canola oil": 172336, // Oil, canola
  "sesame oil": 171016, // Oil, sesame, salad or cooking
  "sunflower oil": 171025, // Oil, sunflower
  "avocado oil": 173573, // Oil, avocado

  // --- Baking / dry goods ---
  flour: 169761, // Wheat flour, white, all-purpose, unenriched
  "wheat flour": 169761,
  "whole wheat flour": 168944, // Wheat flour, whole-grain
  "almond flour": 2261420, // Flour, almond
  "almond meal": 2261420,
  cornmeal: 169697, // Cornmeal, whole-grain, yellow
  bread: 167532, // Bread, white wheat
  breadcrumbs: 174928, // Bread, crumbs, dry, grated, plain
  "bread crumbs": 174928,
  sugar: 169655, // Sugars, granulated
  "brown sugar": 168833, // Sugars, brown
  "powdered sugar": 169656, // Sugars, powdered
  "confectioners sugar": 169656,
  "icing sugar": 169656,
  cornstarch: 169698, // Cornstarch
  "baking powder": 172805, // Leavening agents, baking powder
  "baking soda": 175040, // Leavening agents, baking soda
  yeast: 175043, // Leavening agents, yeast, baker's, active dry
  cocoa: 169593, // Cocoa, dry powder, unsweetened
  "cocoa powder": 169593,
  chocolate: 170272, // Chocolate, dark, 60-69% cacao
  vanilla: 173471, // Vanilla extract
  "vanilla extract": 173471,

  // --- Legumes (cooked — density table is cooked-consistent) ---
  chickpea: 173799, // Chickpeas, mature seeds, cooked
  "black beans": 175237, // Beans, black, mature seeds, cooked
  "kidney beans": 175242, // Beans, kidney, red, mature seeds, cooked
  "pinto beans": 173796, // Beans, pinto, mature seeds, cooked
  "white beans": 175249, // Beans, white, mature seeds, cooked
  "cannellini beans": 175249,
  cannellini: 175249,
  "navy beans": 173794, // Beans, navy, mature seeds, cooked
  lentil: 175254, // Lentils, mature seeds, cooked
  "split peas": 175257, // Peas, split, mature seeds, cooked

  // --- Spices / dried herbs ---
  salt: 173468, // Salt, table
  pepper: 170931, // Spices, pepper, black
  "black pepper": 170931,
  paprika: 171329, // Spices, paprika
  cumin: 170923, // Spices, cumin seed
  cinnamon: 171320, // Spices, cinnamon, ground
  oregano: 171328, // Spices, oregano, dried
  thyme: 170938, // Spices, thyme, dried
  rosemary: 171333, // Spices, rosemary, dried
  turmeric: 172231, // Spices, turmeric, ground
  nutmeg: 171326, // Spices, nutmeg, ground
  "bay leaf": 170917, // Spices, bay leaf
  "bay leaves": 170917,
  "garlic powder": 171325, // Spices, garlic powder
  "onion powder": 171327, // Spices, onion powder
  "chili powder": 171319, // Spices, chili powder
  "curry powder": 170924, // Spices, curry powder
  "ginger powder": 170926, // Spices, ginger, ground
  // Chili / red-pepper flakes -> the dried red-pepper spice (#170932), NOT the
  // "Cereal, wheat flakes" that free-text search used to return. "red pepper"
  // (bare) is deliberately NOT mapped here — it collides with red bell pepper.
  "chili flakes": 170932, // Spices, pepper, red or cayenne
  "chilli flakes": 170932,
  "chili flake": 170932,
  "chilli flake": 170932,
  "red pepper flakes": 170932,
  "red pepper flake": 170932,
  "chili pepper": 170932,
  chili: 170932,
  chilli: 170932,
  cayenne: 170932,
  "cayenne pepper": 170932,

  // --- Sauces / condiments ---
  "soy sauce": 174278, // Soy sauce (tamari)
  "fish sauce": 174531, // Sauce, fish, ready-to-serve
  "hot sauce": 174527, // Sauce, ready-to-serve, pepper or hot
  "chili sauce": 174527,
  "bbq sauce": 174523, // Sauce, barbecue
  "barbecue sauce": 174523,
  "worcestershire sauce": 171610, // Sauce, worcestershire
  worcestershire: 171610,
  vinegar: 173469, // Vinegar, cider
  "balsamic vinegar": 172241, // Vinegar, balsamic
  mayonnaise: 171009, // Salad dressing, mayonnaise, regular
  mustard: 172234, // Mustard, prepared, yellow
  ketchup: 168556, // Catsup
  "tomato sauce": 170054, // Tomato products, canned, sauce
  "tomato paste": 170459, // Tomato products, canned, paste

  // --- Sweeteners / liquids ---
  honey: 169640, // Honey
  "maple syrup": 169661, // Syrups, maple
  "corn syrup": 168837, // Syrups, corn, light
  molasses: 168820, // Molasses
  agave: 170277, // Sweetener, syrup, agave
  "agave syrup": 170277,
  "agave nectar": 170277,
  coffee: 171890, // Beverages, coffee, brewed, prepared with tap water
  "chicken broth": 174536, // Soup, chicken broth, ready-to-serve
  "vegetable broth": 171180, // Soup, vegetable broth
};

/**
 * Look up the curated canonical fdcId for a (normalized) ingredient name.
 * Tries an exact match, then strips a trailing plural (`-s`/`-es`) so
 * "eggs"/"onions"/"tomatoes" resolve to their singular key. Returns `null` for
 * anything not in the curated set (callers fall back to USDA search).
 */
export function stapleFdcId(name: string): number | null {
  const key = name.toLowerCase().trim();
  if (key in STAPLE_FDC_IDS) return STAPLE_FDC_IDS[key];
  // Plural → singular: -ies→y ("cherries"→"cherry"), then -es ("tomatoes"→
  // "tomato"), then -s ("onions"→"onion"). Without -ies→y, berry/cherry-style
  // plurals silently missed their staple.
  const candidates = [
    key.replace(/ies$/, "y"),
    key.replace(/es$/, ""),
    key.replace(/s$/, ""),
  ];
  for (const singular of candidates) {
    if (singular !== key && singular in STAPLE_FDC_IDS) {
      return STAPLE_FDC_IDS[singular];
    }
  }
  return null;
}
