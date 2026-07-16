/**
 * Shopping Item Transformer
 *
 * Transforms recipe ingredient amounts into shopping-friendly quantities.
 * Converts recipe units (tbs, tsp, cups) to standard units (g, ml, pieces)
 * and rounds to sensible shopping amounts.
 */

import { normalizeUnit, toBaseAmount } from "./unit-registry";

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
// Ingredient classification
// ============================================================================

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
  const base = toBaseAmount(item.amount, normalizeUnit(item.unit));

  const common = {
    name: item.name,
    originalAmount: item.amount,
    originalUnit: item.unit,
    category: item.category,
    notes: item.notes,
  };

  // Count units (and anything the registry doesn't recognize) have no base
  // conversion — show a plain count.
  if (!base) {
    const roundedCount = Math.ceil(item.amount);
    return { ...common, displayQuantity: `${roundedCount}` };
  }

  // Weight → grams.
  if (base.base === "g") {
    const rounded = roundToShoppingAmount(base.amount);
    return { ...common, displayQuantity: formatQuantity(rounded, "g") };
  }

  // Volume → ml for liquids; for solids approximate to grams (dry goods are
  // lighter than water, ~0.8 g/ml).
  if (isLiquidIngredient(item.name)) {
    const rounded = roundToShoppingAmount(base.amount);
    return { ...common, displayQuantity: formatQuantity(rounded, "ml") };
  }
  const rounded = roundToShoppingAmount(base.amount * 0.8);
  return { ...common, displayQuantity: formatQuantity(rounded, "g") };
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
