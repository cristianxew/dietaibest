"use client";

import { Recipe, RecipeCategory, UserFavorite } from "@/generated/prisma";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Clock, Utensils, Flame } from "lucide-react";
import { CategoryIcon } from "./CategoryIcon";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/actions/recipe";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: Recipe & {
    categories: RecipeCategory[];
    favoritedBy: UserFavorite[];
  };
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const t = useTranslations("recipes");
  const pathname = usePathname();
  const locale = pathname.split("/")[1];
  const [isPending, startTransition] = useTransition();
  const [isFavorited, setIsFavorited] = useState(recipe.favoritedBy.length > 0);

  const handleToggleFavorite = () => {
    startTransition(async () => {
      try {
        const result = await toggleFavorite(recipe.id);
        if (result.error) {
          toast.error(result.error);
        } else {
          setIsFavorited(result.data?.favorited || false);
          toast.success(
            result.data?.favorited ? t("favoriteAdded") : t("favoriteRemoved")
          );
        }
      } catch {
        toast.error(t("favoriteError"));
      }
    });
  };

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <Card className="group relative overflow-hidden hover:shadow-lg transition-shadow">
      {/* Favorite button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleToggleFavorite}
        disabled={isPending}
      >
        <Heart
          className={cn("h-5 w-5", isFavorited && "fill-red-500 text-red-500")}
        />
        <span className="sr-only">
          {isFavorited ? t("removeFavorite") : t("addFavorite")}
        </span>
      </Button>

      <Link href={`/${locale}/recipes/${recipe.id}`}>
        {/* Recipe image */}
        {recipe.imageUrl && (
          <div className="aspect-video w-full overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}

        <CardHeader>
          <CardTitle className="line-clamp-2">{recipe.title}</CardTitle>
          {recipe.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {recipe.description}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Categories */}
          {recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {recipe.categories.map((category) => (
                <Badge
                  key={category.id}
                  variant="secondary"
                  className="text-xs flex items-center gap-1"
                >
                  <CategoryIcon
                    iconName={category.iconName || undefined}
                    className="h-3 w-3"
                  />
                  {category.name}
                </Badge>
              ))}
            </div>
          )}

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {totalTime > 0 && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>{totalTime}m</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <Utensils className="h-4 w-4" />
              <span>
                {recipe.servings} {t("servings")}
              </span>
            </div>
            {recipe.calories && (
              <div className="flex items-center gap-1">
                <Flame className="h-4 w-4" />
                <span>
                  {Math.round(recipe.calories)} {t("cal")}
                </span>
              </div>
            )}
          </div>

          {/* Difficulty badge */}
          {recipe.difficulty && (
            <Badge
              variant={
                recipe.difficulty === "easy"
                  ? "default"
                  : recipe.difficulty === "medium"
                  ? "secondary"
                  : "destructive"
              }
            >
              {t(`difficulty.${recipe.difficulty}`)}
            </Badge>
          )}
        </CardContent>

        <CardFooter>
          {/* Macro nutrients */}
          {(recipe.protein || recipe.carbs || recipe.fat) && (
            <div className="flex justify-between w-full text-xs">
              {recipe.protein && (
                <div>
                  <span className="text-muted-foreground">
                    {t("protein")}:{" "}
                  </span>
                  <span className="font-medium">
                    {Math.round(recipe.protein)}g
                  </span>
                </div>
              )}
              {recipe.carbs && (
                <div>
                  <span className="text-muted-foreground">{t("carbs")}: </span>
                  <span className="font-medium">
                    {Math.round(recipe.carbs)}g
                  </span>
                </div>
              )}
              {recipe.fat && (
                <div>
                  <span className="text-muted-foreground">{t("fat")}: </span>
                  <span className="font-medium">{Math.round(recipe.fat)}g</span>
                </div>
              )}
            </div>
          )}
        </CardFooter>
      </Link>
    </Card>
  );
}
