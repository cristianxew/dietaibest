"use client";

import { useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ShoppingCart, LayoutGrid, UtensilsCrossed, Loader2 } from "lucide-react";
import { ShoppingListHeader } from "./ShoppingListHeader";
import { CategoryView } from "./CategoryView";
import { RecipeView } from "./RecipeView";
import { EmptyState } from "./EmptyState";
import { StorePreferencesPreview } from "./StorePreferencesPreview";
import { ShoppingAutomationButton } from "./ShoppingAutomationButton";
import { generateShoppingList } from "@/actions/shopping-list";
import type {
  ShoppingListResult,
  ShoppingListIngredient,
} from "@/types/shopping-list";
import type { DateRange } from "@/components/custom-ui/date-picker";
import { cn } from "@/lib/utils";
import {
  normalizeUnit,
  stripStateWords,
  applySynonyms,
} from "@/lib/ingredients";
import { categorizeIngredient } from "@/lib/ingredient-categories";

export function ShoppingListPage() {
  const t = useTranslations("shopping");

  // Date range state - no default selection
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });

  // Shopping list state
  const [shoppingList, setShoppingList] = useState<ShoppingListResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state - partial purchasing model
  // Tracks purchased amounts in base units per ingredient ID
  const [purchasedAmounts, setPurchasedAmounts] = useState<
    Record<string, number>
  >({});
  // Tracks which recipe-ingredient pairs have been toggled (recipeId_ingredientId)
  const [toggledRecipeIngredients, setToggledRecipeIngredients] = useState<
    Set<string>
  >(new Set());
  const [servingsOverrides, setServingsOverrides] = useState<
    Record<string, number>
  >({});
  const [removedRecipes, setRemovedRecipes] = useState<Set<string>>(new Set());

  // Handle date range change
  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      if (range) {
        setDateRange(range);
      } else {
        // Clear selection
        setDateRange({ from: undefined, to: undefined });
      }
    },
    []
  );

  // Handle generate shopping list
  const handleGenerate = useCallback(async () => {
    if (!dateRange.from || !dateRange.to) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateShoppingList(dateRange.from, dateRange.to);

      if (result.error) {
        setError(result.error);
        setShoppingList(null);
      } else {
        setShoppingList(result.data);
        // Reset UI state when generating new list
        setPurchasedAmounts({});
        setToggledRecipeIngredients(new Set());
        setServingsOverrides({});
        setRemovedRecipes(new Set());
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate shopping list"
      );
      setShoppingList(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  // Handle toggle from CategoryView - toggles full ingredient amount
  const handleCategoryToggle = useCallback(
    (ingredientId: string, baseAmount: number) => {
      setPurchasedAmounts((prev) => {
        const current = prev[ingredientId] || 0;
        if (current >= baseAmount) {
          // Already fully purchased, remove it
          const next = { ...prev };
          delete next[ingredientId];
          return next;
        } else {
          // Purchase the full amount
          return { ...prev, [ingredientId]: baseAmount };
        }
      });
      // Also clear any recipe-specific toggles for this ingredient
      setToggledRecipeIngredients((prev) => {
        const next = new Set(prev);
        for (const key of prev) {
          if (key.endsWith(`_${ingredientId}`)) {
            next.delete(key);
          }
        }
        return next;
      });
    },
    []
  );

  // Handle toggle from RecipeView - adds/removes recipe's portion
  // IMPORTANT: State updates must be separate to avoid double-execution in React StrictMode
  const handleRecipeIngredientToggle = useCallback(
    (recipeId: string, ingredientId: string, amount: number) => {
      const toggleKey = `${recipeId}_${ingredientId}`;

      // Read current toggle state to determine add vs subtract
      const wasToggled = toggledRecipeIngredients.has(toggleKey);

      // Update toggle state
      setToggledRecipeIngredients((prev) => {
        const next = new Set(prev);
        if (wasToggled) {
          next.delete(toggleKey);
        } else {
          next.add(toggleKey);
        }
        return next;
      });

      // Update purchased amounts (separate call to avoid double-execution)
      setPurchasedAmounts((prev) => {
        const current = prev[ingredientId] || 0;
        if (wasToggled) {
          // Subtract this recipe's portion
          const newAmount = Math.max(0, current - amount);
          if (newAmount <= 0) {
            const next = { ...prev };
            delete next[ingredientId];
            return next;
          }
          return { ...prev, [ingredientId]: newAmount };
        } else {
          // Add this recipe's portion
          return { ...prev, [ingredientId]: current + amount };
        }
      });
    },
    [toggledRecipeIngredients]
  );

  // Handle servings change
  const handleServingsChange = useCallback(
    (recipeId: string, servings: number) => {
      setServingsOverrides((prev) => ({
        ...prev,
        [recipeId]: servings,
      }));
    },
    []
  );

  // Handle remove recipe
  const handleRemoveRecipe = useCallback((recipeId: string) => {
    setRemovedRecipes((prev) => new Set(prev).add(recipeId));
  }, []);

  // Filter out removed recipes
  const filteredRecipes = useMemo(() => {
    if (!shoppingList) return [];
    return shoppingList.recipes.filter(
      (recipe) => !removedRecipes.has(recipe.id)
    );
  }, [shoppingList, removedRecipes]);

  // Dynamically recalculate and consolidate ingredients based on current servings
  // Uses simplified logic: NO unit conversion, group by normalizedName + normalizedUnit
  const filteredIngredients = useMemo(() => {
    if (!shoppingList || filteredRecipes.length === 0) return [];

    // Helper to normalize ingredient name
    const normalizeIngredientName = (name: string): string => {
      let normalized = name.toLowerCase().trim();
      normalized = stripStateWords(normalized);
      normalized = applySynonyms(normalized);
      return normalized;
    };

    // Helper to format amount
    const formatAmount = (amount: number): number => {
      return Math.round(amount * 100) / 100;
    };

    // Collect all ingredients from active recipes with adjusted amounts
    interface CollectedIngredient {
      originalName: string;
      amount: number;
      unit: string;
      recipeId: string;
    }

    const collected: CollectedIngredient[] = [];

    for (const recipe of filteredRecipes) {
      const currentServings =
        servingsOverrides[recipe.id] ?? recipe.scheduledServings;
      const multiplier = currentServings / recipe.originalServings;

      for (const ing of recipe.ingredients) {
        collected.push({
          originalName: ing.name,
          amount: ing.originalAmount * multiplier,
          unit: ing.unit,
          recipeId: recipe.id,
        });
      }
    }

    // Consolidate by normalizedName + normalizedUnit (same as server)
    const groups = new Map<
      string,
      {
        normalizedName: string;
        normalizedUnit: string;
        amount: number;
        originalNames: Set<string>;
        recipeIds: Set<string>;
      }
    >();

    for (const item of collected) {
      const normalizedName = normalizeIngredientName(item.originalName);
      const normalizedUnit = normalizeUnit(item.unit);
      const key = `${normalizedName}_${normalizedUnit}`;

      if (!groups.has(key)) {
        groups.set(key, {
          normalizedName,
          normalizedUnit,
          amount: 0,
          originalNames: new Set(),
          recipeIds: new Set(),
        });
      }

      const group = groups.get(key)!;
      group.amount += item.amount;
      group.originalNames.add(item.originalName);
      group.recipeIds.add(item.recipeId);
    }

    const result: ShoppingListIngredient[] = [];

    for (const [id, group] of groups) {
      result.push({
        id,
        name: group.normalizedName,
        originalNames: Array.from(group.originalNames),
        amount: formatAmount(group.amount),
        unit: group.normalizedUnit,
        baseAmount: formatAmount(group.amount), // No conversion, base = display
        baseUnit: group.normalizedUnit,
        category: categorizeIngredient(group.normalizedName),
        recipeIds: Array.from(group.recipeIds),
      });
    }

    return result;
  }, [shoppingList, filteredRecipes, servingsOverrides]);

  // Stats - count fully purchased items
  const totalItems = filteredIngredients.length;
  const checkedCount = filteredIngredients.filter((ing) => {
    const purchased = purchasedAmounts[ing.id] || 0;
    return purchased >= ing.baseAmount;
  }).length;

  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-2">
          <div
            className={cn(
              "p-2.5 rounded-xl",
              "bg-brand-500/10 border border-brand-200/50 dark:border-brand-500/20"
            )}
          >
            <ShoppingCart className="w-5 h-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
        </div>

        {/* Store Preferences Preview */}
        <StorePreferencesPreview />

        {/* Header with Date Range and Actions */}
        <ShoppingListHeader
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          onGenerate={handleGenerate}
          isLoading={isLoading}
          pdfData={
            shoppingList && filteredIngredients.length > 0
              ? {
                  ingredients: filteredIngredients,
                  recipes: filteredRecipes,
                  dateRange: shoppingList.dateRange,
                  metadata: {
                    totalRecipes: filteredRecipes.length,
                    totalMeals: shoppingList.metadata.totalMeals,
                  },
                  purchasedAmounts,
                }
              : undefined
          }
        />

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !shoppingList && !error && (
          <EmptyState type="no-data" onGenerate={handleGenerate} />
        )}

        {/* No Schedules State */}
        {!isLoading &&
          shoppingList &&
          shoppingList.metadata.totalMeals === 0 && (
            <EmptyState type="no-schedules" />
          )}

        {/* Shopping List Content */}
        {!isLoading &&
          shoppingList &&
          shoppingList.metadata.totalMeals > 0 && (
            <>
              {/* Stats Bar with Automation Button */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {checkedCount}/{totalItems} {t("itemsChecked")}
                  </span>
                  <span className="text-border">|</span>
                  <span>
                    {filteredRecipes.length} {t("recipes")}
                  </span>
                </div>

                {/* Shopping Automation Button */}
                <ShoppingAutomationButton
                  ingredients={filteredIngredients}
                  disabled={isLoading || filteredIngredients.length === 0}
                />
              </div>

              {/* Two-Column Layout */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Category View Column */}
                <section
                  className={cn(
                    "flex flex-col rounded-2xl overflow-hidden",
                    "bg-gradient-to-b from-card/80 to-card",
                    "border border-border/60",
                    "shadow-sm"
                  )}
                >
                  {/* Sticky Header */}
                  <div
                    className={cn(
                      "flex items-center gap-3 px-5 py-4",
                      "bg-card/95 backdrop-blur-sm",
                      "border-b border-border/40"
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-xl",
                        "bg-sage-500/15 dark:bg-sage-500/20",
                        "ring-1 ring-sage-500/20"
                      )}
                    >
                      <LayoutGrid className="w-4 h-4 text-sage-600 dark:text-sage-400" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground tracking-tight">
                        {t("viewByCategory")}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {filteredIngredients.length} {t("items")}
                      </p>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div
                    className={cn(
                      "flex-1 overflow-y-auto",
                      "px-4 py-4",
                      "max-h-[60vh] xl:max-h-[65vh]",
                      "scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent"
                    )}
                  >
                    <CategoryView
                      ingredients={filteredIngredients}
                      purchasedAmounts={purchasedAmounts}
                      onToggleItem={handleCategoryToggle}
                    />
                  </div>
                </section>

                {/* Recipe View Column */}
                <section
                  className={cn(
                    "flex flex-col rounded-2xl overflow-hidden",
                    "bg-gradient-to-b from-card/80 to-card",
                    "border border-border/60",
                    "shadow-sm"
                  )}
                >
                  {/* Sticky Header */}
                  <div
                    className={cn(
                      "flex items-center gap-3 px-5 py-4",
                      "bg-card/95 backdrop-blur-sm",
                      "border-b border-border/40"
                    )}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-xl",
                        "bg-gold-500/15 dark:bg-gold-500/20",
                        "ring-1 ring-gold-500/20"
                      )}
                    >
                      <UtensilsCrossed className="w-4 h-4 text-gold-600 dark:text-gold-400" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-foreground tracking-tight">
                        {t("viewByRecipe")}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {filteredRecipes.length} {t("recipes")}
                      </p>
                    </div>
                  </div>

                  {/* Scrollable Content */}
                  <div
                    className={cn(
                      "flex-1 overflow-y-auto",
                      "px-4 py-4",
                      "max-h-[60vh] xl:max-h-[65vh]",
                      "scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent"
                    )}
                  >
                    <RecipeView
                      recipes={filteredRecipes}
                      toggledRecipeIngredients={toggledRecipeIngredients}
                      servingsOverrides={servingsOverrides}
                      onToggleItem={handleRecipeIngredientToggle}
                      onServingsChange={handleServingsChange}
                      onRemoveRecipe={handleRemoveRecipe}
                    />
                  </div>
                </section>
              </div>
            </>
          )}
      </div>
    </div>
  );
}
