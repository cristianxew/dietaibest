"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChefHat, Sparkles, Filter, BookOpen } from "lucide-react";
import { getRecipes, getCategories } from "@/actions/recipe";
import { DraggableRecipeCard } from "./DraggableRecipeCard";
import type { Recipe, RecipeCategory } from "@/generated/prisma";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function RecipeSidebar() {
  const t = useTranslations("mealPlans");
  const tRecipes = useTranslations("recipes");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  // Load categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      const result = await getCategories();
      if (result.data) {
        setCategories(result.data);
      }
    };
    fetchCategories();
  }, []);

  // Load recipes with filters
  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      try {
        const result = await getRecipes({
          search: searchTerm || undefined,
          categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
          difficulty:
            selectedDifficulty !== "all"
              ? (selectedDifficulty as "easy" | "medium" | "hard")
              : undefined,
          sortBy: "title",
          limit: 50,
          page: 1,
        });

        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          setRecipes(result.data.recipes as Recipe[]);
        }
      } catch {
        toast.error("Failed to load recipes");
      } finally {
        setLoading(false);
      }
    };

    startTransition(() => {
      fetchRecipes();
    });
  }, [searchTerm, selectedCategory, selectedDifficulty]);

  const hasActiveFilters = selectedCategory !== "all" || selectedDifficulty !== "all" || searchTerm !== "";

  return (
    <Card className="h-full flex flex-col border-border/60 bg-card/80 backdrop-blur-sm overflow-hidden">
      {/* Header with gradient accent */}
      <div className="relative flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-100/50 to-gold-100/30 dark:from-brand-500/10 dark:to-gold-500/5" />
        <CardHeader className="relative py-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/10 dark:bg-brand-500/20 border border-brand-200/50 dark:border-brand-500/20">
              <ChefHat className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="font-display text-base tracking-tight flex items-center gap-2">
                {t("recipes")}
                <Sparkles className="w-3.5 h-3.5 text-gold-500" />
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("recipesDescription")}
              </p>
            </div>
          </div>
        </CardHeader>
      </div>

      <CardContent className="flex-1 flex flex-col gap-3 min-h-0 p-4 pt-0 overflow-hidden">
        {/* Search Input */}
        <div className="relative group flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
          <Input
            placeholder={t("searchRecipes")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={cn(
              "pl-9 h-10 rounded-xl border-border/60 bg-muted/30",
              "focus:border-brand-300 focus:ring-brand-500/20 dark:focus:border-brand-500/50",
              "placeholder:text-muted-foreground/60 transition-all"
            )}
            disabled={isPending}
          />
        </div>

        {/* Filters Row */}
        <div className="flex gap-2 flex-shrink-0">
          {/* Category Filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isPending}>
            <SelectTrigger className={cn(
              "h-9 text-xs rounded-xl border-border/60 bg-muted/30 flex-1",
              "focus:border-brand-300 focus:ring-brand-500/20",
              selectedCategory !== "all" && "border-brand-300 bg-brand-50/50 dark:bg-brand-500/10"
            )}>
              <SelectValue placeholder={t("allCategories")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">{t("allCategories")}</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id} className="rounded-lg">
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Difficulty Filter */}
          <Select
            value={selectedDifficulty}
            onValueChange={setSelectedDifficulty}
            disabled={isPending}
          >
            <SelectTrigger className={cn(
              "h-9 text-xs rounded-xl border-border/60 bg-muted/30 flex-1",
              "focus:border-brand-300 focus:ring-brand-500/20",
              selectedDifficulty !== "all" && "border-brand-300 bg-brand-50/50 dark:bg-brand-500/10"
            )}>
              <SelectValue placeholder={t("allDifficulties")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="rounded-lg">{t("allDifficulties")}</SelectItem>
              <SelectItem value="easy" className="rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sage-500" />
                  {tRecipes("difficulty.easy")}
                </span>
              </SelectItem>
              <SelectItem value="medium" className="rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-gold-500" />
                  {tRecipes("difficulty.medium")}
                </span>
              </SelectItem>
              <SelectItem value="hard" className="rounded-lg">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-500" />
                  {tRecipes("difficulty.hard")}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Summary */}
        {!loading && (
          <div className="flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              {t("recipesFound", { count: recipes.length })}
            </p>
            {hasActiveFilters && (
              <Badge
                variant="outline"
                className="text-[10px] px-2 py-0.5 rounded-full cursor-pointer hover:bg-muted transition-colors border-brand-200 text-brand-600 dark:border-brand-500/30 dark:text-brand-400"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSelectedDifficulty("all");
                }}
              >
                Clear filters
              </Badge>
            )}
          </div>
        )}

        {/* Recipe List */}
        <ScrollArea className="flex-1 min-h-0 -mx-4 px-4">
          {loading && recipes.length === 0 ? (
            <div className="space-y-3 py-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="p-3 rounded-xl border border-border/40 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-14 h-14 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-14 rounded-full" />
                        <Skeleton className="h-5 w-12 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Filter className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                {t("noRecipesFound")}
              </p>
              <p className="text-xs text-muted-foreground max-w-[200px]">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-2 pb-4">
              {recipes.map((recipe, index) => (
                <div
                  key={recipe.id}
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <DraggableRecipeCard recipe={recipe} />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
