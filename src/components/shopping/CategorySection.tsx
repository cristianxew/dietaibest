"use client";

import { useTranslations } from "next-intl";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { IngredientItem } from "./IngredientItem";
import type {
  ShoppingListIngredient,
  IngredientCategory,
} from "@/types/shopping-list";
import { cn } from "@/lib/utils";
import {
  Apple,
  Carrot,
  Drumstick,
  Milk,
  Wheat,
  Package,
  ShoppingBag,
} from "lucide-react";

interface CategorySectionProps {
  category: IngredientCategory;
  ingredients: ShoppingListIngredient[];
  purchasedAmounts: Record<string, number>;
  onToggleItem: (ingredientId: string, baseAmount: number) => void;
}

const CATEGORY_ICONS: Record<IngredientCategory, React.ElementType> = {
  fruits: Apple,
  vegetables: Carrot,
  proteins: Drumstick,
  dairy: Milk,
  grains: Wheat,
  pantry: Package,
  other: ShoppingBag,
};

const CATEGORY_COLORS: Record<IngredientCategory, string> = {
  fruits: "text-rose-500 bg-rose-50 dark:bg-rose-500/10",
  vegetables: "text-sage-500 bg-sage-50 dark:bg-sage-500/10",
  proteins: "text-amber-600 bg-amber-50 dark:bg-amber-500/10",
  dairy: "text-sky-500 bg-sky-50 dark:bg-sky-500/10",
  grains: "text-yellow-600 bg-yellow-50 dark:bg-yellow-500/10",
  pantry: "text-stone-500 bg-stone-100 dark:bg-stone-500/10",
  other: "text-gray-500 bg-gray-100 dark:bg-gray-500/10",
};

export function CategorySection({
  category,
  ingredients,
  purchasedAmounts,
  onToggleItem,
}: CategorySectionProps) {
  const t = useTranslations("shopping");

  const Icon = CATEGORY_ICONS[category];
  const colorClasses = CATEGORY_COLORS[category];

  // Calculate checked count based on purchased amounts
  const checkedCount = ingredients.filter((ing) => {
    const purchased = purchasedAmounts[ing.id] || 0;
    return purchased >= ing.baseAmount;
  }).length;
  const totalCount = ingredients.length;

  // Helper to get remaining amount and display
  const getRemainingDisplay = (ingredient: ShoppingListIngredient) => {
    const purchased = purchasedAmounts[ingredient.id] || 0;
    const remainingBase = Math.max(0, ingredient.baseAmount - purchased);

    if (remainingBase <= 0) {
      return { amount: 0, isFullyPurchased: true };
    }

    // Calculate display amount proportionally
    const ratio = remainingBase / ingredient.baseAmount;
    const remainingDisplay = Math.round(ingredient.amount * ratio * 100) / 100;

    return { amount: remainingDisplay, isFullyPurchased: false };
  };

  return (
    <AccordionItem value={category} className="border-b-0 mb-3">
      <div
        className={cn(
          "rounded-xl border border-border bg-card overflow-hidden",
          "transition-all duration-200",
          "hover:border-brand-200 dark:hover:border-brand-500/30"
        )}
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-3 flex-1">
            <div className={cn("p-2 rounded-lg", colorClasses)}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="font-medium text-foreground">
              {t(`categories.${category}`)}
            </span>
            <span className="text-xs text-muted-foreground ml-auto mr-2">
              {checkedCount}/{totalCount} {t("items")}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-3">
          <div className="space-y-0.5 pt-1">
            {ingredients.map((ingredient) => {
              const { amount, isFullyPurchased } =
                getRemainingDisplay(ingredient);
              return (
                <IngredientItem
                  key={ingredient.id}
                  id={ingredient.id}
                  name={ingredient.originalNames[0] || ingredient.name}
                  amount={amount}
                  unit={ingredient.unit}
                  isChecked={isFullyPurchased}
                  onToggle={() =>
                    onToggleItem(ingredient.id, ingredient.baseAmount)
                  }
                />
              );
            })}
          </div>
        </AccordionContent>
      </div>
    </AccordionItem>
  );
}
