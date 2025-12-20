/**
 * Shopping Item Transformer
 *
 * Transforms recipe ingredient amounts into shopping-friendly quantities.
 * Converts recipe units (tbs, tsp, cups) to standard units (g, ml, pieces)
 * and rounds to sensible shopping amounts.
 */

// ============================================================================
// Types
// ============================================================================

export interface RecipeItem {
  name: string;
  amount: number;
  unit: string;
  category?: string;
  notes?: string;
}

export interface TransformedShoppingItem {
  name: string;
  displayQuantity: string;
  originalAmount: number;
  originalUnit: string;
  category?: string;
  notes?: string;
}

// ============================================================================
// Unit Conversion Maps
// ============================================================================

/**
 * Volume units to ml conversion
 */
const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  l: 1000,
  liter: 1000,
  litre: 1000,
  cup: 240,
  cups: 240,
  tbs: 15,
  tbsp: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
  "fl oz": 30,
  "fluid ounce": 30,
};

/**
 * Weight units to grams conversion
 */
const WEIGHT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  oz: 28,
  ounce: 28,
  ounces: 28,
  lb: 454,
  lbs: 454,
  pound: 454,
  pounds: 454,
};

/**
 * Count/piece units - these don't get converted
 */
const COUNT_UNITS = new Set([
  "piece",
  "pieces",
  "pcs",
  "whole",
  "clove",
  "cloves",
  "slice",
  "slices",
  "bunch",
  "bunches",
  "head",
  "heads",
  "leaf",
  "leaves",
  "sprig",
  "sprigs",
  "stalk",
  "stalks",
  "unit",
  "units",
  "",
]);

/**
 * Units that should be treated as solids (convert tbs/tsp to grams)
 * For liquids, we convert to ml
 */
const LIQUID_INGREDIENTS = new Set([
  "water",
  "milk",
  "cream",
  "oil",
  "olive oil",
  "vegetable oil",
  "wine",
  "vinegar",
  "broth",
  "stock",
  "juice",
  "soy sauce",
  "sauce",
  "honey",
  "maple syrup",
  "syrup",
]);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize unit string for comparison
 */
function normalizeUnit(unit: string): string {
  return unit.toLowerCase().trim();
}

/**
 * Check if ingredient is likely a liquid
 */
function isLiquidIngredient(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return (
    LIQUID_INGREDIENTS.has(normalizedName) ||
    normalizedName.includes("juice") ||
    normalizedName.includes("sauce") ||
    normalizedName.includes("broth") ||
    normalizedName.includes("stock") ||
    normalizedName.includes("milk") ||
    normalizedName.includes("cream") ||
    normalizedName.includes("oil") ||
    normalizedName.includes("water")
  );
}

/**
 * Round amount to a sensible shopping quantity
 */
function roundToShoppingAmount(amount: number): number {
  if (amount <= 0) return 50;

  if (amount < 100) {
    // Round to nearest 25
    return Math.max(25, Math.round(amount / 25) * 25);
  } else if (amount < 500) {
    // Round to nearest 50
    return Math.round(amount / 50) * 50;
  } else if (amount < 1000) {
    // Round to nearest 100
    return Math.round(amount / 100) * 100;
  } else {
    // Round to nearest 250
    return Math.round(amount / 250) * 250;
  }
}

/**
 * Format quantity for display
 */
function formatQuantity(amount: number, unit: "g" | "ml" | "count"): string {
  if (unit === "count") {
    return amount === 1 ? "1" : `${Math.ceil(amount)}`;
  }

  // Convert large amounts to kg/L
  if (unit === "g" && amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}kg`;
  }
  if (unit === "ml" && amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}L`;
  }

  return `${amount}${unit}`;
}

// ============================================================================
// Main Transformation Function
// ============================================================================

/**
 * Transform a recipe item into a shopping-friendly format
 *
 * @example
 * // Input: { name: "sugar", amount: 3, unit: "tbs" }
 * // Output: { name: "sugar", displayQuantity: "50g", ... }
 *
 * @example
 * // Input: { name: "chicken breast", amount: 80.5, unit: "g" }
 * // Output: { name: "chicken breast", displayQuantity: "100g", ... }
 */
export function transformShoppingItem(item: RecipeItem): TransformedShoppingItem {
  const normalizedUnit = normalizeUnit(item.unit);
  const isLiquid = isLiquidIngredient(item.name);

  let displayQuantity: string;

  // Handle count/piece units - no conversion needed
  if (COUNT_UNITS.has(normalizedUnit)) {
    const roundedCount = Math.ceil(item.amount);
    displayQuantity = roundedCount === 1 ? "1" : `${roundedCount}`;

    return {
      name: item.name,
      displayQuantity,
      originalAmount: item.amount,
      originalUnit: item.unit,
      category: item.category,
      notes: item.notes,
    };
  }

  // Handle weight units
  if (WEIGHT_TO_GRAMS[normalizedUnit] !== undefined) {
    const grams = item.amount * WEIGHT_TO_GRAMS[normalizedUnit];
    const rounded = roundToShoppingAmount(grams);
    displayQuantity = formatQuantity(rounded, "g");

    return {
      name: item.name,
      displayQuantity,
      originalAmount: item.amount,
      originalUnit: item.unit,
      category: item.category,
      notes: item.notes,
    };
  }

  // Handle volume units
  if (VOLUME_TO_ML[normalizedUnit] !== undefined) {
    const ml = item.amount * VOLUME_TO_ML[normalizedUnit];

    if (isLiquid) {
      // Keep as ml/L for liquids
      const rounded = roundToShoppingAmount(ml);
      displayQuantity = formatQuantity(rounded, "ml");
    } else {
      // Convert to grams for solids (approximate: 1ml ≈ 1g for most dry goods)
      // This is a rough approximation - adjust factor based on ingredient if needed
      const grams = ml * 0.8; // Most dry ingredients are lighter than water
      const rounded = roundToShoppingAmount(grams);
      displayQuantity = formatQuantity(rounded, "g");
    }

    return {
      name: item.name,
      displayQuantity,
      originalAmount: item.amount,
      originalUnit: item.unit,
      category: item.category,
      notes: item.notes,
    };
  }

  // Unknown unit - try to make a sensible default
  // Assume it's a count unit
  const roundedCount = Math.ceil(item.amount);
  displayQuantity = roundedCount === 1 ? "1" : `${roundedCount}`;

  return {
    name: item.name,
    displayQuantity,
    originalAmount: item.amount,
    originalUnit: item.unit,
    category: item.category,
    notes: item.notes,
  };
}

/**
 * Transform an array of recipe items for shopping
 */
export function transformShoppingItems(items: RecipeItem[]): TransformedShoppingItem[] {
  return items.map(transformShoppingItem);
}

/**
 * Format items as a simple shopping list string
 * Output format: "- ingredient name: quantity"
 */
export function formatAsShoppingList(items: TransformedShoppingItem[]): string {
  return items.map((item) => `- ${item.name}: ${item.displayQuantity}`).join("\n");
}
