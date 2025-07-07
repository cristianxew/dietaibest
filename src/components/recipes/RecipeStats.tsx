"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getRecipeStats } from "@/actions/recipe";
import { CategoryIcon } from "./CategoryIcon";
import { Heart, ChefHat } from "lucide-react";
import { useTranslations } from "next-intl";

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
      <Card>
        <CardHeader>
          <CardTitle>{t("stats.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat className="h-5 w-5" />
          {t("stats.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Total and favorites summary */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <ChefHat className="h-3 w-3" />
              {stats.totalRecipes} {t("stats.total")}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-500" />
              {stats.favoriteRecipes} {t("favorites")}
            </Badge>
          </div>
        </div>

        {/* Categories breakdown */}
        {stats.categoryStats.length > 0 && (
          <div>
            <h4 className="font-medium mb-2">{t("stats.byCategory")}</h4>
            <div className="flex flex-wrap gap-1">
              {stats.categoryStats
                .filter((cat) => cat.recipeCount > 0)
                .map((category) => (
                  <Badge
                    key={category.id}
                    variant="secondary"
                    className="flex items-center gap-1 text-xs"
                  >
                    <CategoryIcon
                      iconName={category.iconName || undefined}
                      className="h-3 w-3"
                    />
                    {category.name} ({category.recipeCount})
                  </Badge>
                ))}
            </div>
            {stats.categoryStats.every((cat) => cat.recipeCount === 0) && (
              <p className="text-sm text-muted-foreground">
                {t("stats.noRecipesInCategories")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
