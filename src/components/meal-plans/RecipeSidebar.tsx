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
import { Search, ChefHat } from "lucide-react";
import { getRecipes, getCategories } from "@/actions/recipe";
import { DraggableRecipeCard } from "./DraggableRecipeCard";
import type { Recipe, RecipeCategory } from "@/generated/prisma";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "next-intl";

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ChefHat className="w-5 h-5" />
          {t("recipes")}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("recipesDescription")}
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 min-h-0 p-4 pt-0">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder={t("searchRecipes")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-sm"
            disabled={isPending}
          />
        </div>

        {/* Category Filter */}
        <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isPending}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={t("allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allCategories")}</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
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
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={t("allDifficulties")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allDifficulties")}</SelectItem>
            <SelectItem value="easy">{tRecipes("difficulty.easy")}</SelectItem>
            <SelectItem value="medium">{tRecipes("difficulty.medium")}</SelectItem>
            <SelectItem value="hard">{tRecipes("difficulty.hard")}</SelectItem>
          </SelectContent>
        </Select>

        {/* Recipe Count */}
        {!loading && (
          <p className="text-xs text-muted-foreground">
            {t("recipesFound", { count: recipes.length })}
          </p>
        )}

        {/* Recipe List */}
        <ScrollArea className="flex-1 -mx-4 px-4 max-h-[400px]">
          {loading && recipes.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">{t("noRecipesFound")}</p>
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {recipes.map((recipe) => (
                <DraggableRecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
