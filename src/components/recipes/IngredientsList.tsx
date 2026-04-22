import { Ingredient } from "@/types/recipe";
import type { Prisma } from "@/generated/prisma";

interface IngredientsListProps {
  ingredients: Prisma.JsonValue;
  multiplier?: number;
}

export function IngredientsList({ ingredients, multiplier = 1 }: IngredientsListProps) {
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
    <ul className="space-y-0">
      {ingredientsList.map((ingredient: Ingredient, index: number) => {
        const scaledAmount = parseFloat((ingredient.amount * multiplier).toFixed(2));
        return (
          <li key={index} className="flex items-start gap-4 py-3.5 border-b border-border/50 last:border-0 relative">
            <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0 mt-1.5" />
            <span className="flex-1 flex flex-wrap items-baseline gap-x-1.5 text-base">
              <span className="font-bold font-display text-foreground tabular-nums">{scaledAmount}</span>
              <span className="font-medium text-foreground">{ingredient.unit}</span>
              <span className="text-muted-foreground ml-1">{ingredient.name}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
