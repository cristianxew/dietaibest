"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Plus,
  Link2,
  UtensilsCrossed,
} from "lucide-react";

interface Recipe {
  id: string;
  title: string;
  imageUrl?: string | null;
  calories?: number | null;
  categories: { id: string; name: string; slug: string }[];
}

interface RecentRecipesCarouselProps {
  recipes: Recipe[];
}

export function RecentRecipesCarousel({ recipes }: RecentRecipesCarouselProps) {
  const t = useTranslations("dashboard.recentRecipes");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Empty state
  if (recipes.length === 0) {
    return (
      <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display font-semibold tracking-tight">
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-900/30 dark:to-gold-900/30 flex items-center justify-center mb-4">
              <UtensilsCrossed className="h-7 w-7 text-brand-500" />
            </div>
            <h3 className="font-medium text-foreground mb-1">{t("noRecipes")}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              {t("noRecipesDescription")}
            </p>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href="/recipes/new" className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t("createRecipe")}
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/recipes/new?mode=url" className="gap-2">
                  <Link2 className="h-4 w-4" />
                  {t("importRecipe")}
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-display font-semibold tracking-tight">
            {t("title")}
          </CardTitle>
          <Button asChild variant="ghost" size="sm" className="text-xs gap-1">
            <Link href="/recipes">
              {t("viewAll")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative">
        {/* Scroll buttons */}
        {recipes.length > 3 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity -ml-2"
              aria-label="Scroll left"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white dark:bg-stone-800 shadow-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity -mr-2"
              aria-label="Scroll right"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Fade gradients */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card to-transparent z-[5] pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent z-[5] pointer-events-none" />

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2 -mx-2 px-2"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {recipes.map((recipe, index) => (
            <Link
              key={recipe.id}
              href={`/recipes/${recipe.id}`}
              className="flex-shrink-0 w-40 group"
              style={{
                scrollSnapAlign: "start",
                animationDelay: `${index * 50}ms`,
              }}
            >
              {/* Image */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-2">
                {recipe.imageUrl ? (
                  <Image
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="160px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <UtensilsCrossed className="h-8 w-8 text-stone-300 dark:text-stone-600" />
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Category badge */}
                {recipe.categories[0] && (
                  <Badge
                    variant="secondary"
                    className="absolute top-2 left-2 text-[10px] px-1.5 py-0 bg-white/90 dark:bg-black/70 backdrop-blur-sm"
                  >
                    {recipe.categories[0].name}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h4 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                {recipe.title}
              </h4>

              {/* Calories */}
              {recipe.calories && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {recipe.calories} {t("kcal")}
                </p>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
