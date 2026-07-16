"use client";

import * as React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Apple, ChefHat, Loader2, Search } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  StyledTabs as Tabs,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";
import {
  searchMyRecipes,
  type ItemRef,
  type RecipePickerItem,
} from "@/actions/nutrition-hub";

interface FdcFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
}

export interface PickedItem {
  ref: ItemRef;
  label: string;
}

interface ItemSearchComboboxProps {
  onSelect: (item: PickedItem) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Unified picker for the Nutrition Hub: searches USDA foods (existing
 * /api/fdc/search endpoint) or the user's own recipes, returning an
 * ItemRef + display label.
 */
export function ItemSearchCombobox({
  onSelect,
  placeholder,
  className,
}: ItemSearchComboboxProps) {
  const t = useTranslations("nutritionHub.compare.search");
  const [open, setOpen] = React.useState(false);
  const [source, setSource] = React.useState<"foods" | "recipes">("foods");
  const [query, setQuery] = React.useState("");
  const [foods, setFoods] = React.useState<FdcFoodItem[]>([]);
  const [recipes, setRecipes] = React.useState<RecipePickerItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const debouncedQuery = useDebounce(query, 300);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        setFoods([]);
        setRecipes([]);
        return;
      }
      setIsLoading(true);
      try {
        if (source === "foods") {
          const response = await fetch("/api/fdc/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: debouncedQuery }),
          });
          if (!response.ok) throw new Error("Search failed");
          const data: FdcFoodItem[] = await response.json();
          if (!cancelled) setFoods(data);
        } else {
          const result = await searchMyRecipes({ query: debouncedQuery });
          if (!cancelled) setRecipes(result.error === null ? result.data : []);
        }
      } catch (error) {
        console.error("[ItemSearchCombobox] search error:", error);
        if (!cancelled) {
          setFoods([]);
          setRecipes([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, source]);

  const pick = (item: PickedItem) => {
    onSelect(item);
    setQuery("");
    setFoods([]);
    setRecipes([]);
    setOpen(false);
  };

  const results = source === "foods" ? foods : recipes;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim().length >= 2) setOpen(true);
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true);
            }}
            placeholder={placeholder ?? t("placeholder")}
            autoComplete="off"
            className="pr-10"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-80 p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b border-border">
          <Tabs
            value={source}
            onValueChange={(v) => setSource(v as "foods" | "recipes")}
          >
            <TabsList className="w-full">
              <TabsTrigger value="foods" className="flex-1">
                <Apple className="w-3.5 h-3.5 mr-1.5" />
                {t("foodsTab")}
              </TabsTrigger>
              <TabsTrigger value="recipes" className="flex-1">
                <ChefHat className="w-3.5 h-3.5 mr-1.5" />
                {t("recipesTab")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                {t("searching")}
              </div>
            )}
            {!isLoading && results.length === 0 && (
              <CommandEmpty>
                {query.trim().length < 2 ? t("minChars") : t("noResults")}
              </CommandEmpty>
            )}
            {!isLoading && source === "foods" && foods.length > 0 && (
              <CommandGroup heading={t("foodsHeading")}>
                {foods.map((food) => (
                  <CommandItem
                    key={food.fdcId}
                    value={`fdc-${food.fdcId}`}
                    onSelect={() =>
                      pick({
                        ref: { type: "fdc", id: food.fdcId },
                        label: food.description,
                      })
                    }
                    className="flex flex-col items-start gap-1 py-2.5 cursor-pointer"
                  >
                    <span className="font-medium text-sm line-clamp-1">
                      {food.description}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {food.dataType}
                      </Badge>
                      {food.brandOwner && (
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {food.brandOwner}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!isLoading && source === "recipes" && recipes.length > 0 && (
              <CommandGroup heading={t("recipesHeading")}>
                {recipes.map((recipe) => (
                  <CommandItem
                    key={recipe.id}
                    value={`recipe-${recipe.id}`}
                    onSelect={() =>
                      pick({
                        ref: { type: "recipe", id: recipe.id },
                        label: recipe.title,
                      })
                    }
                    className="flex items-center gap-3 py-2.5 cursor-pointer"
                  >
                    {recipe.imageUrl ? (
                      <Image
                        src={recipe.imageUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="rounded-lg object-cover w-8 h-8"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <ChefHat className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-sm line-clamp-1">
                        {recipe.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("servings", { count: recipe.servings })}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
