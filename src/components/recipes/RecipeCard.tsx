"use client";

import { Recipe, RecipeCategory, UserFavorite } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Heart, Clock, Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavorite } from "@/actions/recipe";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RecipeCardProps {
  recipe: Recipe & {
    categories: RecipeCategory[];
    favoritedBy: UserFavorite[];
    user?: { id: string; email: string };
  };
  showAuthor?: boolean;
  viewMode?: "grid" | "list";
}

const getCategoryStyles = (categoryName?: string) => {
  const n = categoryName?.toLowerCase() || '';
  if (n.includes('breakfast')) {
    return {
      bg: 'bg-gold-50/80 dark:bg-gold-500/10',
      text: 'text-gold-600 dark:text-gold-400',
      badgeBg: 'bg-gold-100/80 dark:bg-gold-900/40',
      badgeText: 'text-gold-700 dark:text-gold-400',
    };
  }
  if (n.includes('lunch')) {
    return {
      bg: 'bg-sage-50/80 dark:bg-sage-500/10',
      text: 'text-sage-600 dark:text-sage-400',
      badgeBg: 'bg-sage-100/80 dark:bg-sage-900/40',
      badgeText: 'text-sage-700 dark:text-sage-400',
    };
  }
  if (n.includes('snack')) {
    return {
      bg: 'bg-brand-50/50 dark:bg-brand-500/5',
      text: 'text-brand-400 dark:text-brand-300',
      badgeBg: 'bg-stone-100/80 dark:bg-stone-800/40',
      badgeText: 'text-stone-600 dark:text-stone-300',
    };
  }
  // Default (e.g. Dinner)
  return {
    bg: 'bg-brand-100/40 dark:bg-brand-500/10',
    text: 'text-brand-600 dark:text-brand-400',
    badgeBg: 'bg-brand-50 dark:bg-brand-900/30',
    badgeText: 'text-brand-600 dark:text-brand-400',
  };
};

export function RecipeCard({ recipe, showAuthor = false, viewMode = "grid" }: RecipeCardProps) {
  const t = useTranslations("recipes");
  const params = useParams();
  const locale = params.locale as string;
  const [isPending, startTransition] = useTransition();
  const [isFavorited, setIsFavorited] = useState(recipe.favoritedBy.length > 0);
  const [imageError, setImageError] = useState(false);

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
  const primaryCategory = recipe.categories[0]?.name || 'DINNER';
  const styles = getCategoryStyles(primaryCategory);
  
  const showImage = Boolean(recipe.imageUrl && !imageError);

  return (
    <Link href={`/${locale}/recipes/${recipe.id}`} className="block group">
      <article
        className={cn(
          "relative overflow-hidden rounded-2xl bg-card border border-border/60 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
          viewMode === "list" ? "flex flex-row items-center p-3 gap-5" : "flex flex-col h-full hover:-translate-y-1"
        )}
      >
        {/* Placeholder Block or Real Image */}
        <div 
          className={cn(
            "relative flex items-center justify-center overflow-hidden shrink-0",
            viewMode === "list" ? "aspect-square w-24 h-24 sm:w-28 sm:h-28 rounded-xl" : "aspect-[4/3] w-full",
            !showImage && styles.bg
          )}
          style={!showImage ? {
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.03) 10px, rgba(0,0,0,0.03) 20px)`
          } : undefined}
        >
          {showImage ? (
            <>
              <img 
                src={recipe.imageUrl!} 
                alt={recipe.title} 
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110" 
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-60 group-hover:opacity-70 transition-opacity duration-500" />
            </>
          ) : (
            <span className={cn("font-semibold tracking-[0.2em] uppercase", viewMode === "list" ? "text-[10px]" : "text-sm", styles.text)}>
              {primaryCategory}
            </span>
          )}

          {/* Conditional Heart inside image ONLY for GRID view! */}
          {viewMode === "grid" && (
            <button
              className={cn(
                "absolute right-3 top-3 z-10 flex items-center justify-center",
                "h-8 w-8 rounded-full shadow-sm transition-transform hover:scale-110",
                showImage ? "bg-white/20 backdrop-blur-md" : "bg-white dark:bg-stone-900"
              )}
              onClick={handleToggleFavorite}
              disabled={isPending}
            >
              <Heart
                className={cn(
                  "h-4 w-4 transition-colors",
                  isFavorited
                    ? "fill-brand-500 text-brand-500"
                    : showImage ? "text-white fill-transparent" : "text-muted-foreground fill-transparent"
                )}
              />
            </button>
          )}

          {/* Time Pill for GRID view */}
          {viewMode === "grid" && totalTime > 0 && (
            <div
              className={cn(
                "absolute left-3 bottom-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm",
                showImage ? "bg-white/20 backdrop-blur-md text-white" : "bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300"
              )}
            >
              <Clock className={cn("h-3.5 w-3.5", showImage ? "text-white/80" : "text-stone-400")} />
              <span>{totalTime}m</span>
            </div>
          )}

          {/* Difficulty Pill for GRID view */}
          {viewMode === "grid" && recipe.difficulty && (
            <div
              className={cn(
                "absolute right-3 bottom-3 px-3 py-1 rounded-full text-[11px] font-semibold shadow-sm lowercase",
                showImage 
                  ? "bg-white/20 backdrop-blur-md text-white" 
                  : cn("bg-white dark:bg-stone-900", 
                      recipe.difficulty === "easy" ? "text-sage-500 dark:text-sage-400" :
                      recipe.difficulty === "medium" ? "text-gold-500 dark:text-gold-400" :
                      "text-brand-500 dark:text-brand-400")
              )}
            >
              {t(`difficulty.${recipe.difficulty}`)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn("flex flex-col bg-transparent flex-1 min-w-0 overflow-hidden", viewMode === "list" ? "py-1 pr-2" : "p-5")}>
            {viewMode === "grid" ? (
              <>
                <div className="mb-3">
                  <span
                    className={cn(
                      "inline-flex text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5",
                      styles.badgeBg, styles.badgeText
                    )}
                  >
                    {primaryCategory}
                  </span>
                </div>

                <h3
                  className="font-display text-lg font-bold leading-tight mb-2 text-card-foreground line-clamp-2"
                  title={recipe.title}
                >
                  {recipe.title}
                </h3>

                {recipe.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 leading-relaxed" title={recipe.description}>
                    {recipe.description}
                  </p>
                )}

                {showAuthor && recipe.user && (
                  <p className="text-xs text-muted-foreground mb-4 truncate" title={recipe.user.email}>
                    {t("byAuthor", { author: recipe.user.email.split("@")[0] })}
                  </p>
                )}

                <div className="mt-auto pt-2 space-y-3">
                  {(recipe.calories || recipe.protein || recipe.carbs || recipe.fat) && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[11px] font-medium text-muted-foreground pt-1">
                      {recipe.calories && (
                        <span className="bg-brand-50/60 dark:bg-brand-500/10 text-brand-500/90 dark:text-brand-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.calories)} kcal</span>
                      )}
                      {recipe.protein && (
                        <span className="bg-sage-50/80 dark:bg-sage-500/10 text-sage-600/90 dark:text-sage-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.protein)}g P</span>
                      )}
                      {recipe.carbs && (
                        <span className="bg-gold-50/80 dark:bg-gold-500/10 text-gold-600/90 dark:text-gold-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.carbs)}g C</span>
                      )}
                      {recipe.fat && (
                        <span className="bg-brand-50/40 dark:bg-brand-500/10 text-brand-400/90 dark:text-brand-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.fat)}g F</span>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-row justify-between items-start w-full">
                <div className="flex flex-col flex-1 min-w-0 pr-4">
                  <h3 className="font-display text-base font-bold text-card-foreground line-clamp-2" title={recipe.title}>
                    {recipe.title}
                  </h3>
                  {recipe.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1" title={recipe.description}>
                      {recipe.description}
                    </p>
                  )}
                  {showAuthor && recipe.user && (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={recipe.user.email}>
                      {t("byAuthor", { author: recipe.user.email.split("@")[0] })}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium mt-3">
                    {recipe.calories && <span className="bg-brand-50/60 dark:bg-brand-500/10 text-brand-500/90 dark:text-brand-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.calories)} kcal</span>}
                    {recipe.protein && <span className="bg-sage-50/80 dark:bg-sage-500/10 text-sage-600/90 dark:text-sage-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.protein)}g P</span>}
                    {recipe.carbs && <span className="bg-gold-50/80 dark:bg-gold-500/10 text-gold-600/90 dark:text-gold-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.carbs)}g C</span>}
                    {recipe.fat && <span className="bg-brand-50/40 dark:bg-brand-500/10 text-brand-400/90 dark:text-brand-400 px-1.5 py-0.5 rounded-md">{Math.round(recipe.fat)}g F</span>}
                    {totalTime > 0 && (
                      <span className="flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded-sm text-stone-500 dark:text-stone-400">
                        <Clock className="w-3 h-3"/>{totalTime}m
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end shrink-0 gap-3 justify-between h-full">
                  <div className="flex gap-2">
                    {recipe.difficulty && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground lowercase">
                        {t(`difficulty.${recipe.difficulty}`)}
                      </span>
                    )}
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", styles.badgeBg, styles.badgeText)}>
                      {primaryCategory}
                    </span>
                  </div>
                  <button 
                    onClick={handleToggleFavorite} 
                    disabled={isPending}
                    className="p-1.5 hover:bg-muted rounded-full transition-colors mt-auto"
                  >
                    <Heart className={cn("w-4 h-4", isFavorited ? "fill-brand-500 text-brand-500" : "text-muted-foreground")} />
                  </button>
                </div>
              </div>
            )}
        </div>
      </article>
    </Link>
  );
}
