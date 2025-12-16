"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Sunrise,
  Sun,
  Moon,
  Cookie,
  Cake,
  Coffee,
  Leaf,
  Carrot,
  Scale,
  Wheat,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryStat {
  id: string;
  name: string;
  slug: string;
  iconName: string | null;
  recipeCount: number;
}

interface CategoryBreakdownProps {
  categories: CategoryStat[];
  totalRecipes: number;
}

// Map icon names to Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  sunrise: Sunrise,
  sun: Sun,
  moon: Moon,
  cookie: Cookie,
  cake: Cake,
  coffee: Coffee,
  leaf: Leaf,
  carrot: Carrot,
  scale: Scale,
  "wheat-off": Wheat,
};

const getIcon = (iconName: string | null) => {
  if (!iconName) return UtensilsCrossed;
  return iconMap[iconName] || UtensilsCrossed;
};

// Color palette for categories
const categoryColors = [
  { bg: "bg-brand-100 dark:bg-brand-900/30", bar: "bg-brand-500" },
  { bg: "bg-gold-100 dark:bg-gold-900/30", bar: "bg-gold-500" },
  { bg: "bg-sage-100 dark:bg-sage-900/30", bar: "bg-sage-500" },
  { bg: "bg-blue-100 dark:bg-blue-900/30", bar: "bg-blue-500" },
  { bg: "bg-purple-100 dark:bg-purple-900/30", bar: "bg-purple-500" },
];

export function CategoryBreakdown({
  categories,
  totalRecipes,
}: CategoryBreakdownProps) {
  const t = useTranslations("dashboard.categories");

  // Sort by count and take top 5
  const topCategories = [...categories]
    .filter((c) => c.recipeCount > 0)
    .sort((a, b) => b.recipeCount - a.recipeCount)
    .slice(0, 5);

  // Calculate max for proportional bars
  const maxCount = Math.max(...topCategories.map((c) => c.recipeCount), 1);

  if (totalRecipes === 0 || topCategories.length === 0) {
    return (
      <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display font-semibold tracking-tight">
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center mb-3">
              <Scale className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("noRecipes")}</p>
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
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {topCategories.map((category, index) => {
          const Icon = getIcon(category.iconName);
          const colors = categoryColors[index % categoryColors.length];
          const percentage = (category.recipeCount / maxCount) * 100;

          return (
            <Link
              key={category.id}
              href={`/recipes?category=${category.slug}`}
              className="group block"
            >
              <div
                className="flex items-center gap-3 p-2 -mx-2 rounded-lg transition-colors hover:bg-stone-50 dark:hover:bg-stone-800/50"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Icon */}
                <div className={cn("p-1.5 rounded-lg flex-shrink-0", colors.bg)}>
                  <Icon className="h-4 w-4 text-foreground/70" />
                </div>

                {/* Name and bar */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {category.name}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono ml-2">
                      {category.recipeCount} {t("recipes")}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        colors.bar
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}

        {/* See all link */}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-full text-xs mt-2"
        >
          <Link href="/recipes" className="gap-1">
            {t("seeAll")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
