"use client";

import { RecipeCard } from "./RecipeCard";
import type { ShoppingListRecipe } from "@/types/shopping-list";

interface RecipeViewProps {
  recipes: ShoppingListRecipe[];
  toggledRecipeIngredients: Set<string>;
  servingsOverrides: Record<string, number>;
  onToggleItem: (
    recipeId: string,
    ingredientId: string,
    baseAmount: number
  ) => void;
  onServingsChange: (recipeId: string, servings: number) => void;
  onRemoveRecipe: (recipeId: string) => void;
}

export function RecipeView({
  recipes,
  toggledRecipeIngredients,
  servingsOverrides,
  onToggleItem,
  onServingsChange,
  onRemoveRecipe,
}: RecipeViewProps) {
  return (
    <div className="space-y-4">
      {recipes.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          toggledRecipeIngredients={toggledRecipeIngredients}
          servingsOverride={servingsOverrides[recipe.id]}
          onToggleItem={(ingredientId, baseAmount) =>
            onToggleItem(recipe.id, ingredientId, baseAmount)
          }
          onServingsChange={(servings) => onServingsChange(recipe.id, servings)}
          onRemove={() => onRemoveRecipe(recipe.id)}
        />
      ))}
    </div>
  );
}
