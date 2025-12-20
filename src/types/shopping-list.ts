import { z } from "zod";

// ============================================================================
// Ingredient Category Enum
// ============================================================================

export const ingredientCategoryEnum = z.enum([
  "fruits",
  "vegetables",
  "proteins",
  "dairy",
  "grains",
  "pantry",
  "other",
]);

export type IngredientCategory = z.infer<typeof ingredientCategoryEnum>;

export const INGREDIENT_CATEGORIES: IngredientCategory[] = [
  "fruits",
  "vegetables",
  "proteins",
  "dairy",
  "grains",
  "pantry",
  "other",
];

// ============================================================================
// Shopping List Item
// ============================================================================

export interface ShoppingListIngredient {
  /** Unique ID for the item (generated from normalized name + unitType) */
  id: string;
  /** Normalized ingredient name */
  name: string;
  /** All original names that were consolidated */
  originalNames: string[];
  /** Consolidated quantity (display amount) */
  amount: number;
  /** Display unit (best unit for the amount) */
  unit: string;
  /** Amount in base units (ml for volume, g for weight, raw for count) */
  baseAmount: number;
  /** Base unit type: 'ml', 'g', or the count unit */
  baseUnit: string;
  /** Assigned category */
  category: IngredientCategory;
  /** Which recipes use this ingredient */
  recipeIds: string[];
}

// ============================================================================
// Recipe with Ingredients (for Recipe View)
// ============================================================================

export interface ShoppingListRecipe {
  id: string;
  title: string;
  imageUrl?: string | null;
  /** Recipe's default servings */
  originalServings: number;
  /** Total servings from meal plan */
  scheduledServings: number;
  ingredients: ShoppingListRecipeIngredient[];
}

export interface ShoppingListRecipeIngredient {
  id: string;
  name: string;
  /** Amount for scheduled servings (display) */
  amount: number;
  /** Display unit */
  unit: string;
  /** Amount per single recipe serving (in original units) */
  originalAmount: number;
  /** Amount in base units (ml for volume, g for weight, raw for count) */
  baseAmount: number;
  /** Base unit type */
  baseUnit: string;
}

// ============================================================================
// Shopping List Result
// ============================================================================

export interface ShoppingListResult {
  /** Consolidated ingredients for category view */
  ingredients: ShoppingListIngredient[];
  /** Recipes with their ingredients for recipe view */
  recipes: ShoppingListRecipe[];
  dateRange: {
    startDate: string; // ISO date string
    endDate: string;
  };
  metadata: {
    totalRecipes: number;
    totalMeals: number;
    schedulesIncluded: string[];
  };
}

// ============================================================================
// Client-Side State
// ============================================================================

export interface ShoppingListState {
  data: ShoppingListResult | null;
  isLoading: boolean;
  error: string | null;
  /** Ingredient IDs that are checked */
  checkedItems: Set<string>;
  /** Recipe ID -> custom servings override */
  servingsOverrides: Record<string, number>;
  viewMode: "category" | "recipe";
}

// ============================================================================
// Schemas for validation
// ============================================================================

export const generateShoppingListSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
});

export type GenerateShoppingListInput = z.infer<
  typeof generateShoppingListSchema
>;
