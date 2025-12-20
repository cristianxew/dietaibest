"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Utensils, Plus, Flame, Sparkles, ChefHat } from "lucide-react";
import { getRecipes } from "@/actions/recipe";
import type { Recipe } from "@/generated/prisma";
import Image from "next/image";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface RecipePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRecipe: (recipeId: string, recipeName: string) => void;
  dayId?: string;
  mealType?: string;
}

// Get difficulty color
function getDifficultyColor(difficulty: string | null) {
  switch (difficulty?.toLowerCase()) {
    case "easy":
      return "bg-sage-100 text-sage-700 border-sage-200 dark:bg-sage-500/20 dark:text-sage-400 dark:border-sage-500/30";
    case "medium":
      return "bg-gold-100 text-gold-700 border-gold-200 dark:bg-gold-500/20 dark:text-gold-400 dark:border-gold-500/30";
    case "hard":
      return "bg-brand-100 text-brand-700 border-brand-200 dark:bg-brand-500/20 dark:text-brand-400 dark:border-brand-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function RecipePicker({
  open,
  onOpenChange,
  onSelectRecipe,
  mealType,
}: RecipePickerProps) {
  const t = useTranslations("mealPlans");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    startTransition(async () => {
      const result = await getRecipes({ page: 1, search, limit: 20 });
      if (result.error) {
        toast.error(result.error);
      } else if (result.data) {
        setRecipes(result.data.recipes as Recipe[]);
        setHasSearched(true);
      }
    });
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    onSelectRecipe(recipe.id, recipe.title);
    onOpenChange(false);
    setSearch("");
    setRecipes([]);
    setHasSearched(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] p-0 gap-0 rounded-2xl overflow-hidden border-border/60">
        {/* Header with gradient */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-100/50 to-gold-100/30 dark:from-brand-500/10 dark:to-gold-500/5" />
          <DialogHeader className="relative p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 border border-brand-200/50 dark:border-brand-500/20">
                <ChefHat className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg tracking-tight flex items-center gap-2">
                  {t("picker.selectRecipe")}
                  <Sparkles className="w-4 h-4 text-gold-500" />
                </DialogTitle>
                {mealType && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {t("picker.forMealType", { mealType })}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Search Section */}
        <div className="px-6 pb-4">
          <div className="flex gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
              <Input
                placeholder={t("searchRecipes")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                className={cn(
                  "pl-10 h-11 rounded-xl border-border/60 bg-muted/30",
                  "focus:border-brand-300 focus:ring-brand-500/20 dark:focus:border-brand-500/50",
                  "placeholder:text-muted-foreground/60 transition-all"
                )}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isPending}
              className="h-11 px-6 rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 transition-all hover:shadow-lg hover:shadow-brand-500/30"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Searching...
                </span>
              ) : (
                tCommon("search")
              )}
            </Button>
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="h-[400px] px-6 pb-6">
          {isPending && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-500/20 flex items-center justify-center mb-4 animate-pulse">
                <Search className="w-6 h-6 text-brand-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                {t("picker.loadingRecipes")}
              </p>
            </div>
          )}

          {!isPending && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-500/20 dark:to-gold-500/10 flex items-center justify-center mb-4">
                <Utensils className="w-10 h-10 text-brand-500 dark:text-brand-400" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t("picker.searchPrompt")}
              </p>
              <p className="text-xs text-muted-foreground max-w-[250px]">
                Search for your favorite recipes to add to your meal plan
              </p>
            </div>
          )}

          {!isPending && hasSearched && recipes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t("picker.noResults")}
              </p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Try a different search term
              </p>
            </div>
          )}

          {!isPending && recipes.length > 0 && (
            <div className="space-y-3">
              {recipes.map((recipe, index) => (
                <Card
                  key={recipe.id}
                  className={cn(
                    "group p-4 cursor-pointer transition-all duration-200 overflow-hidden",
                    "border-border/60 bg-card/80",
                    "hover:border-brand-200/60 dark:hover:border-brand-500/30 hover:shadow-lg hover:-translate-y-0.5"
                  )}
                  style={{ animationDelay: `${index * 30}ms` }}
                  onClick={() => handleSelectRecipe(recipe)}
                >
                  {/* Subtle gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-50/0 to-gold-50/0 group-hover:from-brand-50/30 group-hover:to-gold-50/20 dark:group-hover:from-brand-500/5 dark:group-hover:to-gold-500/5 transition-all duration-300 pointer-events-none" />

                  <div className="relative flex items-start gap-4">
                    {/* Recipe Image */}
                    {recipe.imageUrl ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-border/40">
                        <Image
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="80px"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-500/20 dark:to-gold-500/10 flex items-center justify-center flex-shrink-0 border border-brand-200/50 dark:border-brand-500/20">
                        <Utensils className="w-8 h-8 text-brand-500 dark:text-brand-400" />
                      </div>
                    )}

                    {/* Recipe Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-display font-semibold text-foreground line-clamp-1 group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                        {recipe.title}
                      </h3>
                      {recipe.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {recipe.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-3">
                        {recipe.calories && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0.5 rounded-full border-brand-200/60 bg-brand-50/50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400"
                          >
                            <Flame className="w-3 h-3 mr-1" />
                            {Math.round(recipe.calories)} cal
                          </Badge>
                        )}
                        {recipe.protein && (
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0.5 rounded-full border-sage-200/60 bg-sage-50/50 text-sage-700 dark:border-sage-500/30 dark:bg-sage-500/10 dark:text-sage-400"
                          >
                            {Math.round(recipe.protein)}g protein
                          </Badge>
                        )}
                        {recipe.difficulty && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs px-2 py-0.5 rounded-full capitalize",
                              getDifficultyColor(recipe.difficulty)
                            )}
                          >
                            {recipe.difficulty}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Add Button */}
                    <Button
                      size="sm"
                      className="flex-shrink-0 h-10 w-10 p-0 rounded-xl bg-brand-500 hover:bg-brand-600 text-white shadow-md shadow-brand-500/20 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectRecipe(recipe);
                      }}
                    >
                      <Plus className="w-5 h-5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
