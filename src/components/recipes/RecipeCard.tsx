"use client";

import { Recipe, RecipeCategory, UserFavorite } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, Clock, Users, Flame, ChefHat } from "lucide-react";
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

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
  const hasMacros = recipe.protein || recipe.carbs || recipe.fat;

  return (
    <Link href={`/${locale}/recipes/${recipe.id}`} className="block group">
      <article
        className={cn(
          "relative overflow-hidden rounded-2xl",
          "bg-card border border-border",
          "transition-all duration-500 ease-out",
          "hover:shadow-xl hover:shadow-brand-500/8 dark:hover:shadow-brand-500/5",
          "hover:border-brand-200 dark:hover:border-brand-500/30",
          "hover:-translate-y-1"
        )}
      >
        {/* Image Container */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {recipe.imageUrl ? (
            <>
              <img
                src={recipe.imageUrl}
                alt={recipe.title}
                className={cn(
                  "h-full w-full object-cover",
                  "transition-transform duration-700 ease-out",
                  "group-hover:scale-110"
                )}
              />
              {/* Gradient Overlay */}
              <div
                className={cn(
                  "absolute inset-0",
                  "bg-gradient-to-t from-black/60 via-black/20 to-transparent",
                  "opacity-60 group-hover:opacity-70 transition-opacity duration-500"
                )}
              />
            </>
          ) : (
            <div
              className={cn(
                "h-full w-full flex items-center justify-center",
                "bg-gradient-to-br from-brand-50 to-brand-100",
                "dark:from-brand-950 dark:to-brand-900"
              )}
            >
              <ChefHat className="h-16 w-16 text-brand-300 dark:text-brand-700" />
            </div>
          )}

          {/* Favorite Button */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-3 top-3 z-10",
              "h-10 w-10 rounded-full",
              "bg-white/90 dark:bg-black/50 backdrop-blur-sm",
              "border border-white/20",
              "opacity-0 group-hover:opacity-100",
              "translate-y-2 group-hover:translate-y-0",
              "transition-all duration-300",
              "hover:bg-white dark:hover:bg-black/70",
              "hover:scale-110",
              isFavorited && "opacity-100 translate-y-0"
            )}
            onClick={handleToggleFavorite}
            disabled={isPending}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-all duration-300",
                isFavorited
                  ? "fill-brand-500 text-brand-500 scale-110"
                  : "text-stone-600 dark:text-stone-300"
              )}
            />
            <span className="sr-only">
              {isFavorited ? t("removeFavorite") : t("addFavorite")}
            </span>
          </Button>

          {/* Time Badge on Image */}
          {totalTime > 0 && (
            <div
              className={cn(
                "absolute left-3 bottom-3",
                "flex items-center gap-1.5 px-2.5 py-1",
                "rounded-full text-xs font-medium",
                "bg-white/90 dark:bg-black/60 backdrop-blur-sm",
                "text-stone-700 dark:text-stone-200",
                "border border-white/20"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>{totalTime} min</span>
            </div>
          )}

          {/* Difficulty Badge */}
          {recipe.difficulty && (
            <div
              className={cn(
                "absolute right-3 bottom-3",
                "px-2.5 py-1 rounded-full text-xs font-medium",
                "backdrop-blur-sm border",
                recipe.difficulty === "easy" &&
                  "bg-sage-500/90 text-white border-sage-400/50",
                recipe.difficulty === "medium" &&
                  "bg-gold-500/90 text-white border-gold-400/50",
                recipe.difficulty === "hard" &&
                  "bg-brand-500/90 text-white border-brand-400/50"
              )}
            >
              {t(`difficulty.${recipe.difficulty}`)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Categories */}
          {recipe.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {recipe.categories.slice(0, 2).map((category) => (
                <Badge
                  key={category.id}
                  variant="secondary"
                  className={cn(
                    "text-[10px] uppercase tracking-wider font-semibold",
                    "bg-brand-50 text-brand-600 border-brand-100",
                    "dark:bg-brand-950/50 dark:text-brand-400 dark:border-brand-800/50",
                    "px-2 py-0.5"
                  )}
                >
                  <CategoryIcon
                    iconName={category.iconName || undefined}
                    className="h-2.5 w-2.5 mr-1"
                  />
                  {category.name}
                </Badge>
              ))}
              {recipe.categories.length > 2 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5"
                >
                  +{recipe.categories.length - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Title */}
          <h3
            className={cn(
              "font-display text-lg font-semibold leading-snug",
              "text-foreground line-clamp-2 mb-2",
              "group-hover:text-brand-600 dark:group-hover:text-brand-400",
              "transition-colors duration-300"
            )}
          >
            {recipe.title}
          </h3>

          {/* Description */}
          {recipe.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* Stats Row */}
          <div
            className={cn(
              "flex items-center gap-4 text-xs text-muted-foreground",
              "pt-4 border-t border-border/50"
            )}
          >
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-brand-400" />
              <span>
                {recipe.servings} {t("servings")}
              </span>
            </div>
            {recipe.calories && (
              <div className="flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-brand-500" />
                <span className="font-medium text-foreground">
                  {Math.round(recipe.calories)}
                </span>
                <span>{t("cal")}</span>
              </div>
            )}
          </div>

          {/* Macros Bar */}
          {hasMacros && (
            <div className="mt-4 pt-3 border-t border-border/30">
              <div className="flex justify-between items-center text-[11px]">
                {recipe.protein && (
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-foreground">
                      {Math.round(recipe.protein)}g
                    </span>
                    <span className="text-muted-foreground uppercase tracking-wider">
                      {t("protein")}
                    </span>
                  </div>
                )}
                {recipe.carbs && (
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-foreground">
                      {Math.round(recipe.carbs)}g
                    </span>
                    <span className="text-muted-foreground uppercase tracking-wider">
                      {t("carbs")}
                    </span>
                  </div>
                )}
                {recipe.fat && (
                  <div className="flex flex-col items-center">
                    <span className="font-semibold text-foreground">
                      {Math.round(recipe.fat)}g
                    </span>
                    <span className="text-muted-foreground uppercase tracking-wider">
                      {t("fat")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
