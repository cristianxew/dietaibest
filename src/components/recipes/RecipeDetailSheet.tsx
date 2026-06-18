"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getRecipe } from "@/actions/recipe";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IngredientsList } from "./IngredientsList";
import { InstructionsList } from "./InstructionsList";
import { MacroDisplay } from "./MacroDisplay";
import { RecipeMicronutrients } from "./RecipeMicronutrients";
import {
  ChefHat,
  Clock,
  ExternalLink,
  Minus,
  Plus,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface RecipeDetailSheetProps {
  recipeId: string | null;
  onClose: () => void;
  locale?: string;
}

const difficultyBadgeClass: Record<string, string> = {
  easy: "border-sage-300 text-sage-600 dark:border-sage-700 dark:text-sage-400",
  medium: "border-gold-300 text-gold-600 dark:border-gold-700 dark:text-gold-400",
  hard: "border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400",
};

const getCategoryStyles = (categoryName?: string) => {
  const n = categoryName?.toLowerCase() || "";
  if (n.includes("breakfast")) {
    return {
      bg: "bg-gold-50/80 dark:bg-gold-500/10",
      text: "text-gold-600 dark:text-gold-400",
      badgeBg: "bg-gold-100/80 dark:bg-gold-900/40",
      badgeText: "text-gold-700 dark:text-gold-400",
    };
  }
  if (n.includes("lunch")) {
    return {
      bg: "bg-sage-50/80 dark:bg-sage-500/10",
      text: "text-sage-600 dark:text-sage-400",
      badgeBg: "bg-sage-100/80 dark:bg-sage-900/40",
      badgeText: "text-sage-700 dark:text-sage-400",
    };
  }
  if (n.includes("snack")) {
    return {
      bg: "bg-brand-50/50 dark:bg-brand-500/5",
      text: "text-brand-400 dark:text-brand-300",
      badgeBg: "bg-stone-100/80 dark:bg-stone-800/40",
      badgeText: "text-stone-600 dark:text-stone-300",
    };
  }
  // Default (e.g. Dinner)
  return {
    bg: "bg-brand-100/40 dark:bg-brand-500/10",
    text: "text-brand-600 dark:text-brand-400",
    badgeBg: "bg-brand-50 dark:bg-brand-900/30",
    badgeText: "text-brand-600 dark:text-brand-400",
  };
};

export function RecipeDetailSheet({
  recipeId,
  onClose,
  locale = "en",
}: RecipeDetailSheetProps) {
  const t = useTranslations("recipes");
  const [recipe, setRecipe] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPortions, setSelectedPortions] = useState(1);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!recipeId) {
      setRecipe(null);
      return;
    }

    async function load() {
      setLoading(true);
      setImageError(false);
      try {
        const result = await getRecipe(recipeId!);
        if (result.error) {
          console.error("[RecipeDetailSheet] Error loading recipe:", result.error);
        } else if (result.data) {
          setRecipe(result.data);
          setSelectedPortions(result.data.servings);
        }
      } catch (error) {
        console.error("[RecipeDetailSheet] Failed to fetch recipe:", error);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [recipeId]);

  const isOpen = recipeId !== null;
  const multiplier = recipe ? selectedPortions / recipe.servings : 1;
  const totalTime = recipe ? (recipe.prepTime || 0) + (recipe.cookTime || 0) : 0;
  const primaryCategory = recipe?.categories?.[0]?.name || "DINNER";
  const styles = getCategoryStyles(primaryCategory);
  const showImage = recipe && recipe.imageUrl && !imageError;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl h-full p-0 flex flex-col bg-background border-l border-border"
      >
        <SheetHeader className="p-6 border-b border-border flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-xl font-display font-bold text-foreground">
            {loading ? t("recipeDetails") : recipe?.title || t("recipeDetails")}
          </SheetTitle>
          {recipe && (
            <Link
              href={`/${locale}/recipes/${recipe.id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors mr-6"
            >
              <span>{t("backToRecipe")}</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="w-full aspect-[4/3] bg-muted rounded-2xl" />
              <div className="space-y-3">
                <div className="h-8 bg-muted rounded-md w-3/4" />
                <div className="h-4 bg-muted rounded-md w-1/2" />
              </div>
              <div className="h-16 bg-muted rounded-xl w-full" />
              <div className="space-y-3">
                <div className="h-6 bg-muted rounded-md w-1/4" />
                <div className="h-10 bg-muted rounded-md w-full" />
                <div className="h-10 bg-muted rounded-md w-full" />
              </div>
            </div>
          ) : recipe ? (
            <>
              {/* Recipe image / placeholder */}
              {showImage ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-sm border border-border/40">
                  <Image
                    src={recipe.imageUrl!}
                    alt={recipe.title}
                    fill
                    className="object-cover"
                    priority
                    onError={() => setImageError(true)}
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "aspect-[4/3] w-full rounded-2xl border border-border/40 flex flex-col items-center justify-center relative overflow-hidden shadow-xs",
                    styles.bg
                  )}
                  style={{
                    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(0,0,0,0.015) 15px, rgba(0,0,0,0.015) 30px)`,
                  }}
                >
                  <div className="flex flex-col items-center gap-3 text-center p-6">
                    <div
                      className={cn(
                        "h-14 w-14 rounded-full flex items-center justify-center bg-background border border-border/40 shadow-xs",
                        styles.text
                      )}
                    >
                      <ChefHat className="h-7 w-7" />
                    </div>
                    <span className={cn("text-xs font-bold tracking-[0.2em] uppercase", styles.text)}>
                      {primaryCategory}
                    </span>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {recipe.categories.map((cat: any) => (
                  <Badge key={cat.id} className="badge-brand text-xs uppercase tracking-wider font-bold px-3 py-1">
                    {cat.name}
                  </Badge>
                ))}
                {recipe.difficulty && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-semibold px-3 py-1", difficultyBadgeClass[recipe.difficulty])}
                  >
                    {t(`difficulty.${recipe.difficulty}`)}
                  </Badge>
                )}
                {recipe.tags.map((tag: string) => (
                  <Badge key={tag} variant="outline" className="text-xs font-normal text-muted-foreground px-3 py-1 border-border/60">
                    {tag}
                  </Badge>
                ))}
              </div>

              {/* Description */}
              {recipe.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {recipe.description}
                </p>
              )}

              {/* Stats Bar */}
              <div className="flex items-stretch bg-card border border-border/60 rounded-xl overflow-hidden shadow-xs divide-x divide-border/60 w-fit">
                {recipe.prepTime !== null && (
                  <div className="flex flex-col items-center justify-center px-5 py-2.5 min-w-[70px]">
                    <span className="font-bold text-lg text-foreground">{recipe.prepTime}m</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("prepTime")}</span>
                  </div>
                )}
                {recipe.cookTime !== null && (
                  <div className="flex flex-col items-center justify-center px-5 py-2.5 min-w-[70px]">
                    <span className="font-bold text-lg text-foreground">{recipe.cookTime}m</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("cookTime")}</span>
                  </div>
                )}
                {totalTime > 0 && (
                  <div className="flex flex-col items-center justify-center px-5 py-2.5 min-w-[70px]">
                    <span className="font-bold text-lg text-foreground">{totalTime}m</span>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Total</span>
                  </div>
                )}
                <div className="flex flex-col items-center justify-center px-5 py-2.5 min-w-[70px]">
                  <span className="font-bold text-lg text-foreground">{selectedPortions}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("servings")}</span>
                </div>
              </div>

              {/* Adjust Servings */}
              <div className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-4 py-3 shadow-xs">
                <span className="text-xs font-bold text-foreground">{t("portions.adjustServings")}</span>
                <div className="flex items-center gap-2">
                  <button
                    className="h-7.5 w-7.5 rounded-md border border-border/80 flex items-center justify-center text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                    onClick={() => setSelectedPortions((p) => Math.max(1, p - 1))}
                    disabled={selectedPortions <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-xs font-bold font-display tabular-nums">
                    {selectedPortions}
                  </span>
                  <button
                    className="h-7.5 w-7.5 rounded-md border border-border/80 flex items-center justify-center text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                    onClick={() => setSelectedPortions((p) => Math.min(20, p + 1))}
                    disabled={selectedPortions >= 20}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Ingredients List */}
              <div className="bg-card border border-border/60 rounded-2xl p-5 md:p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/45">
                  <h3 className="text-xl font-display font-bold text-foreground">
                    {t("ingredients")}
                  </h3>
                  <span className="text-xs font-semibold text-brand-500">
                    +{selectedPortions} {selectedPortions === 1 ? t("portions.serving", { fallback: "serving" }) : t("portions.servings", { fallback: "servings" })}
                  </span>
                </div>
                <IngredientsList ingredients={recipe.ingredients} multiplier={multiplier} />
              </div>

              {/* Instructions List */}
              <InstructionsList instructions={recipe.instructions} />

              {/* Nutrition and Micronutrients */}
              <div className="space-y-4">
                <MacroDisplay
                  calories={recipe.calories}
                  protein={recipe.protein}
                  carbs={recipe.carbs}
                  fat={recipe.fat}
                  fiber={recipe.fiber}
                  servings={selectedPortions}
                />

                <RecipeMicronutrients nutrition={recipe} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground text-sm">
              <ChefHat className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p>{t("notFound")}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
