"use client";

import { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  getRecipes,
  getPublicRecipes,
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
  Sparkles,
  LayoutGrid,
  List,
} from "lucide-react";
// Tabs removed - using custom toggle buttons
import { toast } from "sonner";
import { Recipe, RecipeCategory, UserFavorite } from "@/generated/prisma";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { useHideOnScroll } from "@/hooks/use-hide-on-scroll";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";
import { AddRecipeButton } from "@/components/recipes/AddRecipeButton";
import {
  RecipeFiltersDrawer,
  ITEMS_PER_PAGE_OPTIONS,
} from "@/components/recipes/RecipeFiltersDrawer";
import { AskDietAIButton } from "@/components/chat/AskDietAIButton";

const RECENT_SEARCHES_KEY = "DietAI-recent-searches";
const MAX_RECENT_SEARCHES = 5;

type SearchSuggestion = {
  type: "title" | "tag" | "category";
  value: string;
};

export function RecipesList({ initialViewMode = "grid" }: { initialViewMode?: "grid" | "list" } = {}) {
  const t = useTranslations("recipes");
  const tChat = useTranslations("chat");
  const tCaps = useTranslations("chat.capabilities");
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialViewMode);
  const [recipes, setRecipes] = useState<
    (Recipe & {
      categories: RecipeCategory[];
      favoritedBy: UserFavorite[];
      user?: { id: string; name: string };
    })[]
  >([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"my" | "public" | "favorites">("my");
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
  const listTopRef = useRef<HTMLDivElement>(null);

  // Below `lg` the sticky toolbar slides away while scrolling down and returns on scroll up
  const { ref: toolbarRef, hidden: toolbarHidden } = useHideOnScroll({
    disabled: showSuggestions,
  });

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

  // Fetch recipes based on active tab
  useEffect(() => {
    const fetchRecipes = async () => {
      setLoading(true);
      try {
        let result;

        if (activeTab === "public") {
          // Fetch public recipes from other users
          result = await getPublicRecipes({
            search: searchTerm || undefined,
            categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
            difficulty:
              selectedDifficulty !== "all"
                ? (selectedDifficulty as "easy" | "medium" | "hard")
                : undefined,
            sortBy,
            page,
            limit: itemsPerPage,
          });
        } else {
          // Fetch user's own recipes (my recipes or favorites)
          result = await getRecipes({
            search: searchTerm || undefined,
            categoryId: selectedCategory !== "all" ? selectedCategory : undefined,
            difficulty:
              selectedDifficulty !== "all"
                ? (selectedDifficulty as "easy" | "medium" | "hard")
                : undefined,
            favorites: activeTab === "favorites" || undefined,
            sortBy,
            page,
            limit: itemsPerPage,
          });
        }

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
    activeTab,
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
    activeTab,
    sortBy,
    itemsPerPage,
  ]);

  if (loading && recipes.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6 lg:space-y-8">
        {/* Loading skeleton for filters — mirrors the compact mobile toolbar */}
        <div className="space-y-3 lg:space-y-4 lg:p-4 lg:rounded-xl lg:bg-card lg:border lg:border-border/50">
          <div className="flex gap-2 lg:gap-3">
            <Skeleton className="h-11 flex-1 rounded-xl" />
            <Skeleton className="h-11 w-11 sm:w-28 rounded-xl lg:hidden" />
            <Skeleton className="hidden lg:block h-11 w-[180px] rounded-lg" />
            <Skeleton className="hidden lg:block h-11 w-[160px] rounded-lg" />
          </div>
          <Skeleton className="h-9 w-full sm:w-96 rounded-lg" />
        </div>

        {/* Loading skeleton for recipe grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl overflow-hidden border border-border/50 bg-card"
            >
              <Skeleton className="aspect-[16/10] sm:aspect-[4/3] w-full" />
              <div className="p-4 sm:p-5 space-y-3">
                <Skeleton className="h-4 w-20 rounded-full" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <div className="pt-3 border-t border-border/30 flex justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
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

  const hasActiveFilters =
    searchTerm ||
    selectedCategory !== "all" ||
    selectedDifficulty !== "all" ||
    activeTab !== "my";

  const getCategoryLabel = (category: RecipeCategory) =>
    category.slug && t.has(`categoryNames.${category.slug}`)
      ? t(`categoryNames.${category.slug}`)
      : category.name;

  const selectedCategoryData = categories.find((c) => c.id === selectedCategory);

  const clearFilters = () => {
    setSelectedCategory("all");
    setSelectedDifficulty("all");
  };

  // Paginating from the bottom of a long list would otherwise leave the user
  // at the bottom of the next page — bring the list back into view.
  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={listTopRef} className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Unified control panel wrapper — full-bleed sticky bar pinned to the top
          of the scroll container (#main-content, which already sits below the
          mobile header). Negative margins cancel PageContainer's padding so the
          bar (and its solid backdrop) spans the full content width; px re-aligns
          the inner card. Below `lg` it hides on scroll down, returns on scroll up. */}
      <div
        ref={toolbarRef}
        className={cn(
          "sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-10 px-4 sm:px-6 lg:px-10 py-3",
          "bg-background/95 backdrop-blur-md border-b border-border/60",
          "transition-transform duration-300 ease-out motion-reduce:transition-none",
          toolbarHidden && "max-lg:-translate-y-full"
        )}
      >
        {/* Unified control panel: Search + Filters + Tabs + Layout (+ Add Recipe on desktop).
            Below `lg` it is a flat two-row bar; category/difficulty move into a bottom drawer. */}
        <div className="flex flex-col gap-3 lg:gap-4 lg:p-4 lg:bg-card lg:border lg:border-border/60 lg:rounded-xl lg:shadow-sm lg:hover:shadow-md lg:transition-shadow lg:duration-300">
          {/* Top Row: Search Input + Filters (drawer below lg, selects from lg) */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Search Input & Suggestions */}
            <div className="relative flex-1 min-w-0">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <Search className="h-4 w-4 text-brand-500" />
              </div>
              <Input
                ref={searchInputRef}
                enterKeyHint="search"
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder") || "Search recipes, tags, ingredients..."}
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
                className={cn(
                  // text-base below lg keeps iOS Safari from zooming in on focus
                  "h-11 pl-11 pr-12 text-base lg:text-sm",
                  "rounded-xl border border-border/40",
                  "bg-muted/40 hover:bg-muted/80",
                  "focus:bg-background focus:border-brand-300 focus:ring-1 focus:ring-brand-200",
                  "placeholder:text-muted-foreground/60 transition-all duration-200",
                  "shadow-sm"
                )}
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSearchInput("");
                    setSearchTerm("");
                  }}
                  aria-label={t("search.clear")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              {/* Search suggestions dropdown */}
              {showSuggestions && (searchInput || recentSearches.length > 0) && (
                <Card
                  ref={suggestionsRef}
                  className={cn(
                    "absolute top-full left-0 right-0 mt-2 z-50",
                    "max-h-[min(20rem,60dvh)] overflow-auto",
                    "shadow-xl border-border/50 rounded-xl"
                  )}
                >
                  {loadingSuggestions && (
                    <div className="p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 animate-pulse text-brand-500" />
                      {t("search.searching")}
                    </div>
                  )}

                  {!loadingSuggestions && suggestions.length > 0 && (
                    <div className="p-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">
                        {t("search.suggestions")}
                      </div>
                      {suggestions.map((suggestion, idx) => (
                        <button
                          key={`${suggestion.type}-${idx}`}
                          onClick={() => applySearch(suggestion.value)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2.5 text-sm",
                            "hover:bg-brand-50 dark:hover:bg-brand-950/30",
                            "rounded-lg transition-colors"
                          )}
                        >
                          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                            {getSuggestionIcon(suggestion.type)}
                          </div>
                          <span className="flex-1 min-w-0 truncate text-left font-medium">
                            {suggestion.value}
                          </span>
                          <Badge
                            variant="secondary"
                            className="hidden sm:inline-flex text-[10px] uppercase tracking-wider"
                          >
                            {t(`search.type.${suggestion.type}`)}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}

                  {!searchInput && recentSearches.length > 0 && (
                    <div className="p-2">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("search.recent")}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearRecentSearches}
                          className="h-6 text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t("search.clearRecent")}
                        </Button>
                      </div>
                      {recentSearches.map((search, idx) => (
                        <button
                          key={idx}
                          onClick={() => applySearch(search)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2.5 text-sm",
                            "hover:bg-muted/50 rounded-lg transition-colors"
                          )}
                        >
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 min-w-0 truncate text-left">{search}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {!loadingSuggestions && searchInput && suggestions.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      {t("search.noSuggestions")}
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Mobile & tablet: filters live in a bottom drawer */}
            <RecipeFiltersDrawer
              className="lg:hidden"
              categories={categories}
              getCategoryLabel={getCategoryLabel}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              selectedDifficulty={selectedDifficulty}
              onDifficultyChange={setSelectedDifficulty}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              onClear={clearFilters}
              totalCount={totalCount}
            />

            {/* Desktop: dropdown filters (Category & Difficulty) */}
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              {/* Category Dropdown */}
              <div className="w-[180px]">
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="w-full h-11 border-border/60 bg-background text-[13px] font-medium hover:border-brand-300 dark:hover:border-brand-500/50 transition-all duration-200">
                    <SelectValue placeholder={t("allCategories")} />
                  </SelectTrigger>
                  <SelectContent className="border-border">
                    <SelectItem value="all" className="text-xs">
                      {t("allCategories")}
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {getCategoryLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty Dropdown */}
              <div className="w-[160px]">
                <Select
                  value={selectedDifficulty}
                  onValueChange={setSelectedDifficulty}
                >
                  <SelectTrigger className="w-full h-11 border-border/60 bg-background text-[13px] font-medium hover:border-brand-300 dark:hover:border-brand-500/50 transition-all duration-200">
                    <SelectValue placeholder={t("allDifficulties") || "All Difficulties"} />
                  </SelectTrigger>
                  <SelectContent className="border-border">
                    <SelectItem value="all" className="text-xs">
                      {t("allDifficulties") || "All Difficulties"}
                    </SelectItem>
                    {["easy", "medium", "hard"].map((diff) => (
                      <SelectItem key={diff} value={diff} className="text-xs capitalize">
                        {t(`difficulty.${diff}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Bottom Row: Tab Pills + Layout switcher (sm+) + Add recipe button (lg+; the page header has it below lg) */}
          <div className="flex items-center justify-between gap-3 lg:border-t lg:border-border/50 lg:pt-3">
            {/* Source/Tabs Pills — full-width segmented control on phones */}
            <div className="flex flex-1 sm:flex-none min-w-0 gap-1 p-0.5 bg-muted border border-border rounded-lg">
              {[
                { id: "my", label: t("allRecipes"), shortLabel: t("tabsShort.my") },
                { id: "public", label: t("publicRecipes"), shortLabel: t("tabsShort.public") },
                { id: "favorites", label: t("favorites"), shortLabel: t("tabsShort.favorites") },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex-1 sm:flex-none min-w-0 truncate px-2 sm:px-3.5 py-2 sm:py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 cursor-pointer",
                      isActive
                        ? "bg-card text-brand-500 shadow-sm"
                        : "bg-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span className="sm:hidden">{tab.shortLabel}</span>
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Layout switcher + Add button (phones get the view switch inside the filters drawer) */}
            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <div className="flex gap-0.5 p-0.5 bg-muted border border-border rounded-lg">
                {(
                  [
                    { id: "grid", Icon: LayoutGrid },
                    { id: "list", Icon: List },
                  ] as const
                ).map(({ id, Icon: LIcon }) => {
                  const isActive = viewMode === id;
                  const label = id === "grid" ? t("gridView") : t("listView");
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setViewMode(id)}
                      aria-pressed={isActive}
                      aria-label={label}
                      className={cn(
                        "flex items-center justify-center p-2 rounded-md transition-all duration-150 cursor-pointer",
                        isActive
                          ? "bg-card text-brand-500 shadow-sm"
                          : "bg-transparent text-muted-foreground hover:text-foreground"
                      )}
                      title={label}
                    >
                      <LIcon className="w-4 h-4" />
                    </button>
                  );
                })}
              </div>

              <AddRecipeButton label={t("addRecipe")} className="hidden lg:inline-flex flex-shrink-0" />
            </div>
          </div>
        </div>
      </div>

      {/* Results summary */}
      {!loading && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 min-w-0 text-sm text-muted-foreground">
            {totalCount > 0 ? (
              <span>
                {t("showing")}{" "}
                <span className="font-medium text-foreground">
                  {(page - 1) * itemsPerPage + 1}-
                  {Math.min(page * itemsPerPage, totalCount)}
                </span>{" "}
                {t("of")}{" "}
                <span className="font-medium text-foreground">{totalCount}</span>{" "}
                {t("recipesCount")}
              </span>
            ) : (
              <span className="text-muted-foreground">{t("noRecipesFoundTitle")}</span>
            )}
            {activeTab === "favorites" && (
              <Badge variant="gold" className="text-[10px]">
                {t("favorites")}
              </Badge>
            )}
            {activeTab === "public" && (
              <Badge variant="secondary" className="text-[10px]">
                {t("publicRecipes")}
              </Badge>
            )}
            {/* Active filters as removable chips — the only visible trace of
                drawer filters on mobile, so each one can be cleared in one tap */}
            {selectedCategoryData && (
              <Badge variant="brand" asChild className="text-[10px] py-1 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  aria-label={t("filters.removeFilter", { name: getCategoryLabel(selectedCategoryData) })}
                >
                  {getCategoryLabel(selectedCategoryData)}
                  <X />
                </button>
              </Badge>
            )}
            {selectedDifficulty !== "all" && (
              <Badge variant="secondary" asChild className="text-[10px] py-1 capitalize">
                <button
                  type="button"
                  onClick={() => setSelectedDifficulty("all")}
                  aria-label={t("filters.removeFilter", { name: t(`difficulty.${selectedDifficulty}`) })}
                >
                  {t(`difficulty.${selectedDifficulty}`)}
                  <X />
                </button>
              </Badge>
            )}
          </div>

          {/* Items per page selector (inside the filters drawer below lg) */}
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t("show")}</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => setItemsPerPage(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px] rounded-lg border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">{t("perPage")}</span>
          </div>
        </div>
      )}

      {/* Recipe grid */}
      {recipes.length === 0 ? (
        <div
          className={cn(
            "text-center py-12 px-5 sm:py-16 sm:px-8 rounded-2xl",
            "bg-muted/30 border border-dashed border-border"
          )}
        >
          <div className="flex justify-center mb-4">
            <EmptyStateIcon icon={ChefHat} size="md" />
          </div>
          <p className="text-lg font-medium text-foreground mb-1">
            {t("noRecipesFoundTitle")}
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {hasActiveFilters
              ? t("adjustFilters")
              : t("startByAdding")}
          </p>
          {!hasActiveFilters && (
            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                {tChat("entry.recipesEmpty.title")}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <AskDietAIButton
                  prompt={tCaps("createRecipeFromDescription.prompt")}
                >
                  {tCaps("createRecipeFromDescription.label")}
                </AskDietAIButton>
                <AskDietAIButton prompt={tCaps("importRecipeFromLink.prompt")}>
                  {tCaps("importRecipeFromLink.label")}
                </AskDietAIButton>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className={cn(
            viewMode === "list"
              ? "flex flex-col gap-3 sm:gap-4"
              : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
          )}>
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} showAuthor={activeTab === "public"} viewMode={viewMode} />
            ))}
          </div>

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <nav
              aria-label={t("pagination")}
              className={cn(
                "flex flex-col sm:flex-row justify-center items-center gap-4 mt-8 pt-6 sm:mt-10 sm:pt-8",
                "border-t border-border/30"
              )}
            >
              {/* Phones: compact previous / "Page X of Y" / next */}
              <div className="flex w-full items-center justify-between gap-2 sm:hidden">
                <Button
                  variant="outline"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isPending}
                  className="h-10 rounded-lg border-border/50 px-3"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("previous")}
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums whitespace-nowrap" aria-current="page">
                  {t("pageOf", { current: page, total: totalPages })}
                </span>
                <Button
                  variant="outline"
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || isPending}
                  className="h-10 rounded-lg border-border/50 px-3"
                >
                  {t("next")}
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="hidden sm:flex items-center gap-1">
                {/* First page button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(1)}
                  disabled={page === 1 || isPending}
                  className="h-9 w-9 rounded-lg border-border/50"
                  title={t("firstPage")}
                  aria-label={t("firstPage")}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Previous page button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(Math.max(1, page - 1))}
                  disabled={page === 1 || isPending}
                  className="h-9 w-9 rounded-lg border-border/50"
                  title={t("previous")}
                  aria-label={t("previous")}
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
                        onClick={() => goToPage(Number(pageNum))}
                        disabled={isPending}
                        aria-current={page === pageNum ? "page" : undefined}
                        className={cn(
                          "h-9 min-w-[2.25rem] rounded-lg",
                          page === pageNum
                            ? "bg-brand-500 hover:bg-brand-600 text-white border-transparent"
                            : "border-border/50"
                        )}
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
                  onClick={() => goToPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages || isPending}
                  className="h-9 w-9 rounded-lg border-border/50"
                  title={t("next")}
                  aria-label={t("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Last page button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => goToPage(totalPages)}
                  disabled={page === totalPages || isPending}
                  className="h-9 w-9 rounded-lg border-border/50"
                  title={t("lastPage")}
                  aria-label={t("lastPage")}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Go to page input */}
              {totalPages > 10 && (
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t("goToPage")}</span>
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
                    className="h-9 w-16 rounded-lg border-border/50"
                    disabled={isPending}
                  />
                </div>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
