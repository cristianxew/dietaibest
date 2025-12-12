"use client";

import { useEffect, useState } from "react";
import { getRecipeStats } from "@/actions/recipe";
import { Heart, ChefHat, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface RecipeStatsData {
  totalRecipes: number;
  favoriteRecipes: number;
  categoryStats: Array<{
    id: string;
    name: string;
    slug: string;
    iconName: string | null;
    recipeCount: number;
  }>;
}

export function RecipeStats() {
  const t = useTranslations("recipes");
  const [stats, setStats] = useState<RecipeStatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const result = await getRecipeStats();
        if (result.data) {
          setStats(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch recipe stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-6">
        <div className="h-6 w-24 bg-muted rounded-full animate-pulse" />
        <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Total recipes stat */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-brand-50 dark:bg-brand-950/50",
          "border border-brand-100 dark:border-brand-800/50"
        )}
      >
        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-brand-500 text-white">
          <ChefHat className="h-4 w-4" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-display font-semibold text-brand-700 dark:text-brand-400">
            {stats.totalRecipes}
          </span>
          <span className="text-sm text-brand-600/70 dark:text-brand-400/70">
            {t("stats.total")}
          </span>
        </div>
      </div>

      {/* Favorites stat */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          "bg-gold-50 dark:bg-gold-900/20",
          "border border-gold-100 dark:border-gold-700/30"
        )}
      >
        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 text-white">
          <Heart className="h-4 w-4" />
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-display font-semibold text-gold-700 dark:text-gold-400">
            {stats.favoriteRecipes}
          </span>
          <span className="text-sm text-gold-600/70 dark:text-gold-400/70">
            {t("favorites")}
          </span>
        </div>
      </div>

      {/* Most popular category (bonus insight) */}
      {stats.categoryStats.length > 0 && (
        <>
          {(() => {
            const topCategory = stats.categoryStats
              .filter((c) => c.recipeCount > 0)
              .sort((a, b) => b.recipeCount - a.recipeCount)[0];

            if (!topCategory) return null;

            return (
              <div
                className={cn(
                  "hidden sm:flex items-center gap-2 px-4 py-2 rounded-full",
                  "bg-sage-50 dark:bg-sage-900/20",
                  "border border-sage-100 dark:border-sage-700/30"
                )}
              >
                <div className="flex items-center justify-center h-7 w-7 rounded-full bg-sage-500 text-white">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-medium text-sage-700 dark:text-sage-400">
                    {topCategory.name}
                  </span>
                  <span className="text-xs text-sage-600/70 dark:text-sage-400/60">
                    · {topCategory.recipeCount} recipes
                  </span>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
