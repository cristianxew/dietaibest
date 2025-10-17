"use client";

import * as React from "react";
import { Check, Loader2, Search } from "lucide-react";
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

/**
 * FDC food item from search API
 */
interface FdcFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
}

/**
 * Props for IngredientAutocomplete component
 */
interface IngredientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Get color for dataType badge
 */
function getDataTypeBadgeVariant(
  dataType: string
): "default" | "secondary" | "outline" | "destructive" {
  switch (dataType) {
    case "Foundation":
      return "default"; // Blue
    case "Survey (FNDDS)":
      return "secondary"; // Gray
    case "SR Legacy":
      return "outline"; // White/Black
    case "Branded":
      return "destructive"; // Red
    default:
      return "outline";
  }
}

/**
 * Ingredient Autocomplete Component
 *
 * Provides real-time autocomplete suggestions from USDA FDC database
 * with debouncing, loading states, and keyboard navigation.
 *
 * @component
 */
export function IngredientAutocomplete({
  value,
  onChange,
  placeholder = "Search ingredient...",
  className,
  disabled = false,
}: IngredientAutocompleteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState(value);
  const [suggestions, setSuggestions] = React.useState<FdcFoodItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce the search query (300ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Fetch suggestions when debounced query changes
  React.useEffect(() => {
    const fetchSuggestions = async () => {
      // Don't search if query is too short
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/fdc/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: debouncedSearchQuery }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Search failed");
        }

        const data: FdcFoodItem[] = await response.json();
        setSuggestions(data);
      } catch (err) {
        console.error("Error fetching FDC suggestions:", err);
        setError(err instanceof Error ? err.message : "Failed to search");
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedSearchQuery]);

  // Handle selection from dropdown
  const handleSelect = (selectedDescription: string) => {
    onChange(selectedDescription);
    setSearchQuery(selectedDescription);
    setOpen(false);
  };

  // Handle input change
  const handleInputChange = (newValue: string) => {
    setSearchQuery(newValue);
    onChange(newValue);
    if (newValue.trim().length >= 2) {
      setOpen(true);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className={cn("relative", className)}>
          <Input
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= 2) {
                setOpen(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-10"
            autoComplete="off"
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
        className="w-[400px] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && (
              <div className="py-6 text-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                Searching USDA database...
              </div>
            )}
            {!isLoading && error && (
              <div className="py-6 px-4 text-center text-sm text-destructive">
                {error}
              </div>
            )}
            {!isLoading && !error && suggestions.length === 0 && (
              <CommandEmpty>
                {searchQuery.trim().length < 2
                  ? "Type at least 2 characters to search"
                  : "No ingredients found"}
              </CommandEmpty>
            )}
            {!isLoading && !error && suggestions.length > 0 && (
              <CommandGroup heading="USDA FoodData Central">
                {suggestions.map((food) => (
                  <CommandItem
                    key={food.fdcId}
                    value={food.description}
                    onSelect={() => handleSelect(food.description)}
                    className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <span className="font-medium text-sm line-clamp-1 flex-1">
                        {food.description}
                      </span>
                      {value === food.description && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant={getDataTypeBadgeVariant(food.dataType)}
                        className="text-xs"
                      >
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
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
