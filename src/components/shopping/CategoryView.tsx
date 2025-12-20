"use client";

import { useMemo } from "react";
import { Accordion } from "@/components/ui/accordion";
import { CategorySection } from "./CategorySection";
import type {
  ShoppingListIngredient,
  IngredientCategory,
} from "@/types/shopping-list";
import { getCategoriesInOrder } from "@/lib/ingredient-categories";

interface CategoryViewProps {
  ingredients: ShoppingListIngredient[];
  purchasedAmounts: Record<string, number>;
  onToggleItem: (ingredientId: string, baseAmount: number) => void;
}

export function CategoryView({
  ingredients,
  purchasedAmounts,
  onToggleItem,
}: CategoryViewProps) {
  // Group ingredients by category
  const groupedIngredients = useMemo(() => {
    const groups: Record<IngredientCategory, ShoppingListIngredient[]> = {
      fruits: [],
      vegetables: [],
      proteins: [],
      dairy: [],
      grains: [],
      pantry: [],
      other: [],
    };

    for (const ingredient of ingredients) {
      groups[ingredient.category].push(ingredient);
    }

    // Sort ingredients within each category alphabetically
    for (const category of Object.keys(groups) as IngredientCategory[]) {
      groups[category].sort((a, b) => a.name.localeCompare(b.name));
    }

    return groups;
  }, [ingredients]);

  // Get categories that have items
  const categoriesWithItems = getCategoriesInOrder().filter(
    (category) => groupedIngredients[category].length > 0
  );

  // Default open all categories
  const defaultOpen = categoriesWithItems;

  return (
    <Accordion
      type="multiple"
      defaultValue={defaultOpen}
      className="space-y-0"
    >
      {categoriesWithItems.map((category) => (
        <CategorySection
          key={category}
          category={category}
          ingredients={groupedIngredients[category]}
          purchasedAmounts={purchasedAmounts}
          onToggleItem={onToggleItem}
        />
      ))}
    </Accordion>
  );
}
