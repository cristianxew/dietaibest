/**
 * PDF Export Types
 * Types for shopping list PDF generation
 *
 * @module types/pdf
 */

import type {
  ShoppingListIngredient,
  ShoppingListRecipe,
} from "./shopping-list";

// ============================================================================
// Export Options
// ============================================================================

export interface PDFExportOptions {
  /** View mode for the PDF layout */
  viewMode: "category" | "recipe";
  /** Whether to include checked (purchased) items */
  includeCheckedItems: boolean;
}

// ============================================================================
// Translation Strings for PDF
// ============================================================================

export interface PDFTranslations {
  title: string;
  generatedBy: string;
  page: string;
  of: string;
  items: string;
  recipes: string;
  servings: string;
  categories: {
    fruits: string;
    vegetables: string;
    proteins: string;
    dairy: string;
    grains: string;
    pantry: string;
    other: string;
  };
}

// ============================================================================
// PDF Generation Input
// ============================================================================

export interface PDFGenerationInput {
  /** Consolidated ingredients for category view */
  ingredients: ShoppingListIngredient[];
  /** Recipes with their ingredients for recipe view */
  recipes: ShoppingListRecipe[];
  /** Date range for the shopping list */
  dateRange: {
    startDate: string;
    endDate: string;
  };
  /** Metadata about the shopping list */
  metadata: {
    totalRecipes: number;
    totalMeals: number;
  };
  /** Amount purchased per ingredient (ingredient ID -> base amount) */
  purchasedAmounts: Record<string, number>;
  /** Current locale for date formatting */
  locale: string;
}
