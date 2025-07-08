"use client";

import { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  getRecipes,
  getCategories,
  getRecipeSearchSuggestions,
} from "@/actions/recipe";
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
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Tag,
  ChefHat,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { Recipe, RecipeCategory, UserFavorite } from "@/generated/prisma";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RECENT_SEARCHES_KEY = "dietaibest-recent-searches";
const MAX_RECENT_SEARCHES = 5;

type SearchSuggestion = {
  type: "title" | "tag" | "category";
  value: string;
};

export function RecipesList() {
  const t = useTranslations("recipes");
  const [recipes, setRecipes] = useState<
    (Recipe & { categories: RecipeCategory[]; favoritedBy: UserFavorite[] })[]
  >([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [showFavorites, setShowFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<
    "createdAt" | "title" | "calories" | "prepTime"
  >("createdAt");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [isPending, startTransition] = useTransition();

  // Search suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  const debouncedSearchInput = useDebounce(searchInput, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Save search to recent searches
  const saveRecentSearch = (search: string) => {
    if (!search.trim()) return;

    const updated = [
      search,
      ...recentSearches.filter((s) => s !== search),
    ].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  // Fetch search suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedSearchInput || debouncedSearchInput.length < 2) {
        setSuggestions([]);
        return;
      }

      setLoadingSuggestions(true);
      try {
        const result = await getRecipeSearchSuggestions(debouncedSearchInput);
        if (result.data) {
          setSuggestions(result.data);
        }
      } catch {
        // Silently fail for suggestions
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearchInput]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchInputRef.current &&
        suggestionsRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          limit: itemsPerPage,
        });

        if (result.error) {
          toast.error(result.error);
        } else if (result.data) {
          setRecipes(result.data.recipes);
          setTotalPages(result.data.pagination.totalPages);
          setTotalCount(result.data.pagination.totalCount);
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
    itemsPerPage,
  ]);

  // Calculate page numbers to display
  const pageNumbers = useMemo(() => {
    const delta = 2; // Number of pages to show on each side of current page
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= page - delta && i <= page + delta)
      ) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  }, [page, totalPages]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    selectedCategory,
    selectedDifficulty,
    showFavorites,
    sortBy,
    itemsPerPage,
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

  // Apply search
  const applySearch = (value: string) => {
    setSearchTerm(value);
    setSearchInput(value);
    setShowSuggestions(false);
    if (value.trim()) {
      saveRecentSearch(value.trim());
    }
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  // Get icon for suggestion type
  const getSuggestionIcon = (type: SearchSuggestion["type"]) => {
    switch (type) {
      case "title":
        return <ChefHat className="h-4 w-4" />;
      case "tag":
        return <Tag className="h-4 w-4" />;
      case "category":
        return <Folder className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and filters */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder={t("searchPlaceholder")}
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setShowSuggestions(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                applySearch(searchInput);
              }
            }}
            onFocus={() => setShowSuggestions(true)}
            className="pl-10 pr-10"
          />
          {searchInput && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
              }}
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {/* Search suggestions dropdown */}
          {showSuggestions && (searchInput || recentSearches.length > 0) && (
            <Card
              ref={suggestionsRef}
              className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-auto shadow-lg"
            >
              {/* Loading state */}
              {loadingSuggestions && (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Searching...
                </div>
              )}

              {/* Suggestions */}
              {!loadingSuggestions && suggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Suggestions
                  </div>
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={`${suggestion.type}-${idx}`}
                      onClick={() => applySearch(suggestion.value)}
                      className="flex items-center gap-2 w-full px-2 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                    >
                      {getSuggestionIcon(suggestion.type)}
                      <span className="flex-1 text-left">
                        {suggestion.value}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.type}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}

              {/* Recent searches */}
              {!searchInput && recentSearches.length > 0 && (
                <div className="p-2">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      Recent Searches
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearRecentSearches}
                      className="h-6 text-xs"
                    >
                      Clear
                    </Button>
                  </div>
                  {recentSearches.map((search, idx) => (
                    <button
                      key={idx}
                      onClick={() => applySearch(search)}
                      className="flex items-center gap-2 w-full px-2 py-2 text-sm hover:bg-accent rounded-md transition-colors"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{search}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* No results */}
              {!loadingSuggestions &&
                searchInput &&
                suggestions.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No suggestions found
                  </div>
                )}
            </Card>
          )}
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
                setSearchInput("");
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
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {totalCount > 0 ? (
                <>
                  Showing {(page - 1) * itemsPerPage + 1}-
                  {Math.min(page * itemsPerPage, totalCount)} of {totalCount}{" "}
                  recipes
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

            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs">Show:</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => setItemsPerPage(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="48">48</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-xs">per page</span>
            </div>
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

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-8">
              <div className="flex items-center gap-1">
                {/* First page button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(1)}
                  disabled={page === 1 || isPending}
                  className="h-8 w-8"
                  title="First page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Previous page button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || isPending}
                  className="h-8 w-8"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1 mx-2">
                  {pageNumbers.map((pageNum, idx) =>
                    pageNum === "..." ? (
                      <span
                        key={`dots-${idx}`}
                        className="px-2 text-muted-foreground"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(Number(pageNum))}
                        disabled={isPending}
                        className="h-8 min-w-[2rem]"
                      >
                        {pageNum}
                      </Button>
                    )
                  )}
                </div>

                {/* Next page button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || isPending}
                  className="h-8 w-8"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Last page button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages || isPending}
                  className="h-8 w-8"
                  title="Last page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Go to page input */}
              {totalPages > 10 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Go to:</span>
                  <Input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={page}
                    onChange={(e) => {
                      const newPage = parseInt(e.target.value);
                      if (
                        !isNaN(newPage) &&
                        newPage >= 1 &&
                        newPage <= totalPages
                      ) {
                        setPage(newPage);
                      }
                    }}
                    className="h-8 w-16"
                    disabled={isPending}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
