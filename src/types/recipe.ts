import { z } from "zod";

// Ingredient schema
export const ingredientSchema = z.object({
  name: z.string().min(1, "Ingredient name is required"),
  amount: z.number().nonnegative("Amount cannot be negative"),
  unit: z.string().optional(),
});

export type Ingredient = z.infer<typeof ingredientSchema>;

// Recipe difficulty enum
export const recipeDifficultyEnum = z.enum(["easy", "medium", "hard"]);
export type RecipeDifficulty = z.infer<typeof recipeDifficultyEnum>;

// Recipe source enum
export const recipeSourceEnum = z.enum([
  "manual",
  "url",
  "imported",
  "generated",
]);
export type RecipeSource = z.infer<typeof recipeSourceEnum>;

// Recipe form schema for creation/editing
export const recipeFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(500).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  prepTime: z.number().int().min(0).optional(),
  cookTime: z.number().int().min(0).optional(),
  servings: z.number().int().min(1, "Servings must be at least 1").default(1),
  difficulty: recipeDifficultyEnum.optional(),
  ingredients: z
    .array(ingredientSchema)
    .min(1, "At least one ingredient is required"),
  instructions: z
    .array(z.string().min(1))
    .min(1, "At least one instruction is required"),
  tags: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
  sourceUrl: z.string().optional().or(z.literal("")).transform(v => v || undefined),

  // Nutritional information (optional, can be calculated later)
  calories: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  fiber: z.number().min(0).optional(),
  // Extended nutrition / micronutrients (optional)
  sugar: z.number().min(0).optional(),
  sodium: z.number().min(0).optional(),
  cholesterol: z.number().min(0).optional(),
  saturatedFat: z.number().min(0).optional(),
  transFat: z.number().min(0).optional(),
  vitaminA: z.number().min(0).optional(),
  vitaminC: z.number().min(0).optional(),
  vitaminD: z.number().min(0).optional(),
  vitaminE: z.number().min(0).optional(),
  vitaminK: z.number().min(0).optional(),
  vitaminB12: z.number().min(0).optional(),
  folate: z.number().min(0).optional(),
  iron: z.number().min(0).optional(),
  calcium: z.number().min(0).optional(),
  magnesium: z.number().min(0).optional(),
  potassium: z.number().min(0).optional(),
  zinc: z.number().min(0).optional(),
});

export type RecipeFormData = z.infer<typeof recipeFormSchema>;

// Recipe filter schema
export const recipeFilterSchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  difficulty: recipeDifficultyEnum.optional(),
  tags: z.array(z.string()).optional(),
  minCalories: z.number().optional(),
  maxCalories: z.number().optional(),
  favorites: z.boolean().optional(),
  sortBy: z.enum(["createdAt", "title", "calories", "prepTime"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(12),
});

export type RecipeFilter = z.infer<typeof recipeFilterSchema>;

// Category schema
export const categorySchema = z.object({
  name: z.string().min(2, "Category name must be at least 2 characters"),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().max(200).optional(),
  iconName: z.string().optional(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;

/**
 * Canonical shape produced by the URL / image / PDF / document recipe
 * extraction pipelines. Single source of truth for any extracted-but-not-yet-
 * persisted recipe traveling through preview, edit, and import flows.
 *
 * Required fields are the irreducible minimum every extractor must emit
 * (`title`, `ingredients`, `instructions`). Everything else — including
 * pipeline metadata `extractedAt` and `confidence` — is optional so legacy
 * producers and consumers keep compiling unchanged.
 */
export interface ImportedRecipe {
  title: string;
  description?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;
  tags?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  cuisine?: string;
  sourceUrl?: string;
  extractedAt?: string;
  confidence?: number;
  /**
   * Set when this preview was cloned from an existing import of the same
   * canonical URL (cross-user dedup); `persistRecipe` may copy that recipe's
   * nutrition instead of re-analyzing. Verified server-side before any copy.
   */
  dedupSourceRecipeId?: string;
}

