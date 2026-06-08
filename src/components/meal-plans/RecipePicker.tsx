"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, ChefHat, Sparkles, Plus } from "lucide-react";
import { getRecipes } from "@/actions/recipe";
import type { Recipe } from "@/generated/prisma";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { RecipeThumb, Chip } from "./shared";
import { Icon } from "./icons";
import { RecipeSidebarSkeleton } from "./MealPlannerSkeletons";

interface RecipePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRecipe: (recipeId: string, recipeName: string) => void;
  /** Already-translated meal-type label, e.g. "Breakfast" */
  mealTypeLabel?: string;
}

export function RecipePicker({
  open,
  onOpenChange,
  onSelectRecipe,
  mealTypeLabel,
}: RecipePickerProps) {
  const t = useTranslations("mealPlans");
  const [search, setSearch] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Load the recipe library once when the picker opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setSearch("");
    (async () => {
      const result = await getRecipes({ page: 1, limit: 50 });
      if (!active) return;
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setRecipes(result.data.recipes as Recipe[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, search]);

  const handlePick = (recipe: Recipe) => {
    onSelectRecipe(recipe.id, recipe.title);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[80vh]">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 space-y-3 text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center flex-shrink-0">
              <ChefHat className="w-[18px] h-[18px] text-brand-600 dark:text-brand-400" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-display text-lg tracking-tight flex items-center gap-2">
                {t("picker.selectRecipe")}
                <Sparkles className="w-4 h-4 text-gold-500 flex-shrink-0" />
              </DialogTitle>
              {mealTypeLabel && (
                <p className="text-[13px] text-muted-foreground truncate">
                  {t("picker.forMealType", { mealType: mealTypeLabel })}
                </p>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              autoFocus={false}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchRecipes")}
              className={cn(
                "w-full h-11 pl-10 pr-3 rounded-xl border border-border bg-background text-foreground text-[14px] outline-none transition-all",
                "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
              )}
            />
          </div>
        </DialogHeader>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 scrollbar-thin">
          {loading ? (
            <div className="flex flex-col gap-2">
              <RecipeSidebarSkeleton />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Search className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm text-muted-foreground max-w-[240px]">
                {t("picker.noResults")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => handlePick(recipe)}
                  className={cn(
                    "group flex items-center gap-3 w-full text-left rounded-xl border border-border bg-card p-2.5 transition-all duration-150 cursor-pointer",
                    "hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-500/5 active:scale-[0.99]"
                  )}
                >
                  <RecipeThumb
                    recipe={{ title: recipe.title, imageUrl: recipe.imageUrl ?? null }}
                    size={48}
                    radius={8}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-foreground truncate leading-[1.3]">
                      {recipe.title}
                    </div>
                    <div className="flex gap-1.5 mt-1 flex-wrap items-center">
                      {recipe.calories != null && (
                        <Chip color="coral" size="xs">
                          {Math.round(recipe.calories)} kcal
                        </Chip>
                      )}
                      {recipe.protein != null && (
                        <Chip color="sage" size="xs">
                          {Math.round(recipe.protein)}g P
                        </Chip>
                      )}
                      {recipe.prepTime != null && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-[3px]">
                          <Icon name="Clock" size={10} />
                          {recipe.prepTime}m
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center flex-shrink-0 text-[#1C1A17]",
                      "sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
