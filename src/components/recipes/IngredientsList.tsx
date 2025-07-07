import { Ingredient } from "@/types/recipe";
import type { Prisma } from "@/generated/prisma";

interface IngredientsListProps {
  ingredients: Prisma.JsonValue;
}

export function IngredientsList({ ingredients }: IngredientsListProps) {
  // Handle both array and JSON formats
  let ingredientsList: Ingredient[] = [];

  if (Array.isArray(ingredients)) {
    ingredientsList = ingredients as Ingredient[];
  } else if (typeof ingredients === "string") {
    try {
      ingredientsList = JSON.parse(ingredients);
    } catch {
      ingredientsList = [];
    }
  } else if (ingredients && typeof ingredients === "object") {
    // Already parsed JSON
    ingredientsList = ingredients as unknown as Ingredient[];
  }

  if (!ingredientsList || ingredientsList.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold">Ingredients</h2>
      <ul className="space-y-2">
        {ingredientsList.map((ingredient: Ingredient, index: number) => (
          <li key={index} className="flex items-start gap-2">
            <span className="text-primary mt-1">•</span>
            <span className="flex-1">
              <span className="font-medium">{ingredient.amount}</span>{" "}
              <span className="text-muted-foreground">{ingredient.unit}</span>{" "}
              <span>{ingredient.name}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
