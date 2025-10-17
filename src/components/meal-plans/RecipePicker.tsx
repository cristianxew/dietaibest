"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Image as ImageIcon, Plus } from "lucide-react";
import { getRecipes } from "@/actions/recipe";
import type { Recipe } from "@/generated/prisma";
import Image from "next/image";
import { toast } from "sonner";

interface RecipePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRecipe: (recipeId: string, recipeName: string) => void;
  dayId?: string;
  mealType?: string;
}

export function RecipePicker({
  open,
  onOpenChange,
  onSelectRecipe,
  dayId,
  mealType,
}: RecipePickerProps) {
  const [search, setSearch] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isPending, startTransition] = useTransition();
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = () => {
    startTransition(async () => {
      const result = await getRecipes({ search, limit: 20 });
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
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Select Recipe{" "}
            {mealType && (
              <span className="text-muted-foreground font-normal">
                for {mealType}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={isPending}>
            Search
          </Button>
        </div>

        {/* Results */}
        <ScrollArea className="h-[400px] pr-4">
          {isPending && (
            <div className="text-center text-muted-foreground py-8">
              Loading recipes...
            </div>
          )}

          {!isPending && !hasSearched && (
            <div className="text-center text-muted-foreground py-8">
              Search for recipes to add to your meal plan
            </div>
          )}

          {!isPending && hasSearched && recipes.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              No recipes found. Try a different search term.
            </div>
          )}

          {!isPending && recipes.length > 0 && (
            <div className="space-y-2">
              {recipes.map((recipe) => (
                <Card
                  key={recipe.id}
                  className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleSelectRecipe(recipe)}
                >
                  <div className="flex items-start gap-3">
                    {/* Recipe Image */}
                    {recipe.imageUrl ? (
                      <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                        <Image
                          src={recipe.imageUrl}
                          alt={recipe.title}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}

                    {/* Recipe Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium line-clamp-1">
                        {recipe.title}
                      </h3>
                      {recipe.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {recipe.description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2">
                        {recipe.calories && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(recipe.calories)} cal
                          </Badge>
                        )}
                        {recipe.protein && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(recipe.protein)}g protein
                          </Badge>
                        )}
                        {recipe.difficulty && (
                          <Badge variant="outline" className="text-xs">
                            {recipe.difficulty}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Add Button */}
                    <Button
                      size="sm"
                      className="flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectRecipe(recipe);
                      }}
                    >
                      <Plus className="w-4 h-4" />
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
