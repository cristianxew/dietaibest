"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { getRecipes, getCategories } from "@/actions/recipe";
import { RecipeCard } from "@/components/recipes/RecipeCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, X } from "lucide-react";
import { toast } from "sonner";
import { Recipe, RecipeCategory, UserFavorite } from "@/generated/prisma";
import { Skeleton } from "@/components/ui/skeleton";

export function RecipesList() {
  const t = useTranslations("recipes");
  const [recipes, setRecipes] = useState<
    (Recipe & { categories: RecipeCategory[]; favoritedBy: UserFavorite[] })[]
  >([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<
    "createdAt" | "title" | "calories" | "prepTime"
  >("createdAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      const result = await getCategories();
      if (result.data) {
        setCategories(result.data);
      }
    };
    fetchCategories();
  }, []);

  // Fetch recipes
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
          favorites: showFavorites || undefined,
          sortBy,
          page,
          limit: 12,
        });

        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          setRecipes(result.data.recipes);
          setTotalPages(result.data.pagination.totalPages);
        }
      } catch {
        toast.error(t("loadError"));
      } finally {
        setLoading(false);
      }
    };

    startTransition(() => {
      fetchRecipes();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchTerm,
    selectedCategory,
    selectedDifficulty,
    showFavorites,
    sortBy,
    page,
  ]);

  if (loading && recipes.length === 0) {
    return (
      <div className="space-y-6">
        {/* Loading skeleton for filters */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        {/* Loading skeleton for recipe grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter options */}
        <div className="flex flex-wrap gap-4">
          {/* Category filter */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
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

          {/* Difficulty filter */}
          <Select
            value={selectedDifficulty}
            onValueChange={setSelectedDifficulty}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("allDifficulties")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allDifficulties")}</SelectItem>
              <SelectItem value="easy">{t("difficulty.easy")}</SelectItem>
              <SelectItem value="medium">{t("difficulty.medium")}</SelectItem>
              <SelectItem value="hard">{t("difficulty.hard")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort by */}
          <Select
            value={sortBy}
            onValueChange={(v) =>
              setSortBy(v as "createdAt" | "title" | "calories" | "prepTime")
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("sortBy")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">{t("sort.newest")}</SelectItem>
              <SelectItem value="title">{t("sort.alphabetical")}</SelectItem>
              <SelectItem value="calories">{t("sort.calories")}</SelectItem>
              <SelectItem value="prepTime">{t("sort.prepTime")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Favorites toggle */}
          <Tabs
            value={showFavorites ? "favorites" : "all"}
            onValueChange={(v) => setShowFavorites(v === "favorites")}
          >
            <TabsList>
              <TabsTrigger value="all">{t("allRecipes")}</TabsTrigger>
              <TabsTrigger value="favorites">{t("favorites")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Clear filters button */}
          {(searchTerm ||
            selectedCategory !== "all" ||
            selectedDifficulty !== "all" ||
            showFavorites) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedCategory("all");
                setSelectedDifficulty("all");
                setShowFavorites(false);
                setPage(1);
              }}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Results summary */}
        {!loading && (
          <div className="text-sm text-muted-foreground">
            {totalPages > 0 ? (
              <>
                Showing {recipes.length} of{" "}
                {recipes.length + (totalPages - 1) * 12} recipes
                {showFavorites && " in favorites"}
                {selectedCategory !== "all" &&
                  categories.find((c) => c.id === selectedCategory) &&
                  ` in ${
                    categories.find((c) => c.id === selectedCategory)?.name
                  }`}
                {selectedDifficulty !== "all" &&
                  ` with ${selectedDifficulty} difficulty`}
              </>
            ) : (
              "No recipes found"
            )}
          </div>
        )}
      </div>

      {/* Recipe grid */}
      {recipes.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{t("noRecipes")}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isPending}
              >
                {t("previous")}
              </Button>
              <span className="flex items-center px-4">
                {t("pageOf", { current: page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isPending}
              >
                {t("next")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
