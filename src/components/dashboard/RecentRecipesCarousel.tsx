"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useParams } from "next/navigation";
import { recipeHref } from "@/lib/recipe-back-link";
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
import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";
import { useRecipeModal } from "@/hooks/use-recipe-modal";

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
  const params = useParams();
  const locale = (params?.locale as string) || "en";
  // The recipe modal is mounted by the protected layout, so open it in place
  // rather than routing through the /recipes/new redirect shim.
  const { openCreate } = useRecipeModal();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollState, recipes.length]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    // Page by most of the visible width so one click reveals new cards.
    const amount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const hasOverflow = canScrollLeft || canScrollRight;

  // Empty state
  if (recipes.length === 0) {
    return (
      <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display font-semibold tracking-tight">
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <EmptyStateIcon icon={UtensilsCrossed} size="sm" className="mb-4" />
            <h3 className="font-medium text-foreground mb-1">{t("noRecipes")}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              {t("noRecipesDescription")}
            </p>
            <div className="flex gap-2">
              <Button
                size="default"
                onClick={openCreate}
                className="gap-2 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <Plus className="h-4 w-4" />
                {t("createRecipe")}
              </Button>
              <Button
                variant="outline"
                size="default"
                onClick={openCreate}
                className="gap-2 hover:bg-muted transition-all"
              >
                <Link2 className="h-4 w-4" />
                {t("importRecipe")}
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
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg font-display font-semibold tracking-tight truncate">
            {t("title")}
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            {/* Scroll controls live in the header so they never cover a card.
                Touch devices swipe instead, so they're hidden on small screens. */}
            {hasOverflow && (
              <div className="hidden sm:flex items-center gap-1 mr-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => scroll("left")}
                  disabled={!canScrollLeft}
                  aria-label="Scroll left"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => scroll("right")}
                  disabled={!canScrollRight}
                  aria-label="Scroll right"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={openCreate}
              aria-label={t("createRecipe")}
              className="text-xs gap-1 h-8 px-2 sm:px-3"
            >
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline">{t("createRecipe")}</span>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs gap-1 h-8">
              <Link href="/recipes">
                {t("viewAll")}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative pt-0">
        {/* Edge fades only where more content is hidden */}
        <div
          className={`absolute left-0 top-0 bottom-2 w-6 bg-gradient-to-r from-card to-transparent z-[5] pointer-events-none transition-opacity ${canScrollLeft ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-card to-transparent z-[5] pointer-events-none transition-opacity ${canScrollRight ? "opacity-100" : "opacity-0"}`}
        />

        {/* Scrollable container */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
        >
          {recipes.map((recipe, index) => (
            <Link
              key={recipe.id}
              href={recipeHref(locale, recipe.id, "/dashboard")}
              className="snap-start shrink-0 w-[42%] min-w-32 max-w-44 sm:w-40 group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Image */}
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 dark:bg-stone-800 mb-2">
                {recipe.imageUrl ? (
                  <Image
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 45vw, 160px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <UtensilsCrossed className="h-8 w-8 text-stone-300 dark:text-stone-600" />
                  </div>
                )}

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
              <h4 className="font-medium text-sm text-foreground line-clamp-2 group-hover:text-brand-600 transition-colors">
                {recipe.title}
              </h4>

              {/* Calories */}
              {recipe.calories != null && recipe.calories > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {Math.round(recipe.calories)} {t("kcal")}
                </p>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
