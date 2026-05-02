import type { RecipeFormData, ImportedRecipeData } from "@/types/recipe";

export function importedToFormData(imported: ImportedRecipeData): RecipeFormData {
  return {
    title: imported.title,
    description: imported.description || "",
    ingredients: imported.ingredients,
    instructions: imported.instructions,
    prepTime: imported.prepTime,
    cookTime: imported.cookTime,
    servings: imported.servings || 1,
    difficulty: imported.difficulty?.toLowerCase() as "easy" | "medium" | "hard" | undefined,
    imageUrl: imported.imageUrl || "",
    tags: [
      ...(imported.tags || []),
      ...(imported.cuisine ? [imported.cuisine] : []),
    ].filter(Boolean),
    categoryIds: [],
    isPublic: false,
    calories: imported.calories,
    protein: imported.protein,
    carbs: imported.carbs,
    fat: imported.fat,
    fiber: imported.fiber,
    sugar: imported.sugar,
    sodium: imported.sodium,
    sourceUrl: imported.sourceUrl || "",
  };
}

type RecipeDbRecord = {
  title: string;
  description: string | null;
  imageUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number;
  difficulty: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ingredients: any;
  instructions: string[];
  tags: string[];
  categories: { id: string }[];
  isPublic?: boolean;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar?: number | null;
  sodium?: number | null;
};

export function recipeToFormData(recipe: RecipeDbRecord): RecipeFormData {
  return {
    title: recipe.title,
    description: recipe.description || "",
    imageUrl: recipe.imageUrl || "",
    prepTime: recipe.prepTime ?? undefined,
    cookTime: recipe.cookTime ?? undefined,
    servings: recipe.servings,
    difficulty: recipe.difficulty as "easy" | "medium" | "hard" | undefined,
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : JSON.parse((recipe.ingredients as string) || "[]"),
    instructions: recipe.instructions,
    tags: recipe.tags,
    categoryIds: recipe.categories.map((cat) => cat.id),
    isPublic: recipe.isPublic ?? false,
    calories: recipe.calories ?? undefined,
    protein: recipe.protein ?? undefined,
    carbs: recipe.carbs ?? undefined,
    fat: recipe.fat ?? undefined,
    fiber: recipe.fiber ?? undefined,
    sugar: recipe.sugar ?? undefined,
    sodium: recipe.sodium ?? undefined,
  };
}

export function ingredientsToNutritionLines(
  ingredients: Array<{ name: string; amount: number; unit: string }>
): string[] {
  return ingredients
    .filter((i) => i.name.trim())
    .map((i) => `${i.amount} ${i.unit} ${i.name}`.trim());
}
