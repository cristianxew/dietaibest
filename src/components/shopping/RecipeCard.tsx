"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Trash2, Minus, Plus, ChefHat, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IngredientItem } from "./IngredientItem";
import type { ShoppingListRecipe } from "@/types/shopping-list";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: ShoppingListRecipe;
  toggledRecipeIngredients: Set<string>;
  servingsOverride?: number;
  onToggleItem: (ingredientId: string, baseAmount: number) => void;
  onServingsChange: (servings: number) => void;
  onRemove: () => void;
}

export function RecipeCard({
  recipe,
  toggledRecipeIngredients,
  servingsOverride,
  onToggleItem,
  onServingsChange,
  onRemove,
}: RecipeCardProps) {
  const t = useTranslations("shopping");
  const [isExpanded, setIsExpanded] = useState(true);

  const currentServings = servingsOverride ?? recipe.scheduledServings;
  const servingsMultiplier = currentServings / recipe.scheduledServings;

  // Calculate adjusted amount based on servings override
  const getAdjustedAmount = (amount: number): number => {
    return Math.round(amount * servingsMultiplier * 100) / 100;
  };

  // Check if this recipe's ingredient is toggled
  const isIngredientToggled = (ingredientId: string): boolean => {
    return toggledRecipeIngredients.has(`${recipe.id}_${ingredientId}`);
  };

  const checkedCount = recipe.ingredients.filter((ing) =>
    isIngredientToggled(ing.id)
  ).length;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        "transition-all duration-200",
        "hover:border-brand-200 dark:hover:border-brand-500/30"
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Recipe Image */}
        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
          {recipe.imageUrl ? (
            <Image
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Title and Actions */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-foreground line-clamp-2">
              {recipe.title}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Servings Control */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">
              {t("servings")}:
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onServingsChange(Math.max(1, currentServings - 1))}
                disabled={currentServings <= 1}
              >
                <Minus className="w-3 h-3" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">
                {currentServings}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={() => onServingsChange(currentServings + 1)}
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Ingredients Section */}
      <div className="border-t border-border">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-between px-4 py-2.5",
            "text-sm text-muted-foreground hover:text-foreground",
            "transition-colors duration-200"
          )}
        >
          <span>
            {t("ingredientsFrom", { recipe: recipe.title })} ({checkedCount}/
            {recipe.ingredients.length})
          </span>
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </button>

        {isExpanded && (
          <div className="px-4 pb-3 space-y-0.5">
            {recipe.ingredients.map((ingredient) => {
              // Use the same adjusted amount for both display and toggle
              // This ensures what you see is exactly what gets toggled
              const adjustedAmount = getAdjustedAmount(ingredient.amount);
              return (
                <IngredientItem
                  key={ingredient.id}
                  id={ingredient.id}
                  name={ingredient.name}
                  amount={adjustedAmount}
                  unit={ingredient.unit}
                  isChecked={isIngredientToggled(ingredient.id)}
                  onToggle={() => onToggleItem(ingredient.id, adjustedAmount)}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
