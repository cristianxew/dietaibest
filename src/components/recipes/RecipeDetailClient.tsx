"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Prisma } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Star, Minus, Plus, ExternalLink, FileText, PenLine } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page-container";
import { RecipeFavoriteButton } from "./RecipeFavoriteButton";
import { RecipeScalableContent } from "./RecipeScalableContent";
import { InstructionsList } from "./InstructionsList";
import { MacroDisplay } from "./MacroDisplay";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { recipeToFormData } from "@/lib/recipe-utils";

interface RecipeDetailClientProps {
  recipe: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    prepTime: number | null;
    cookTime: number | null;
    servings: number;
    difficulty: string | null;
    tags: string[];
    instructions: string[];
    ingredients: Prisma.JsonValue;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
    sourceUrl: string | null;
    source: string | null;
    userId: string;
    categories: { id: string; name: string }[];
    favoritedBy: { id: string }[];
    user: { id: string };
  };
  isOwner: boolean;
  isFavorited: boolean;
  locale: string;
}

const difficultyBadgeClass: Record<string, string> = {
  easy: "border-sage-300 text-sage-600 dark:border-sage-700 dark:text-sage-400",
  medium: "border-gold-300 text-gold-600 dark:border-gold-700 dark:text-gold-400",
  hard: "border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400",
};

export function RecipeDetailClient({
  recipe,
  isOwner,
  isFavorited,
  locale,
}: RecipeDetailClientProps) {
  const t = useTranslations("recipes");
  const [selectedPortions, setSelectedPortions] = useState(recipe.servings);
  const [imageError, setImageError] = useState(false);
  const { openEdit } = useRecipeModal();

  const multiplier = selectedPortions / recipe.servings;
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const showImage = Boolean(recipe.imageUrl && !imageError);

  return (
    <PageContainer>
      <Link
        href={`/${locale}/recipes`}
        className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t("backToRecipes")}
      </Link>

      {/* Top Section: Image + Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start mb-10">

        {/* Image Column */}
        <div className="lg:col-span-5">
          {showImage ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-xl shadow-stone-900/5 border border-black/5 dark:border-white/10">
              <Image
                src={recipe.imageUrl!}
                alt={recipe.title}
                fill
                className="object-cover transition-transform duration-700 hover:scale-105"
                priority
                onError={() => setImageError(true)}
              />
            </div>
          ) : (
            <div className="aspect-[4/3] w-full rounded-2xl bg-muted/20 border border-border flex items-center justify-center">
              <span className="text-sm font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {recipe.categories[0]?.name || "Recipe"}
              </span>
            </div>
          )}
        </div>

        {/* Details Column */}
        <div className="lg:col-span-7 space-y-5">

          {/* Tags row: categories + difficulty + tags */}
          <div className="flex flex-wrap gap-2">
            {recipe.categories.map((cat) => (
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
            {recipe.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs font-normal text-muted-foreground px-3 py-1 border-border/60">
                {tag}
              </Badge>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground leading-[1.1]">
            {recipe.title}
          </h1>

          {/* Description */}
          {recipe.description && (
            <p className="text-base text-muted-foreground leading-relaxed">
              {recipe.description}
            </p>
          )}

          {/* Time Stats Bar */}
          <div className="flex items-stretch bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm divide-x divide-border/60 w-fit">
            {recipe.prepTime !== null && (
              <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[80px]">
                <span className="font-display font-bold text-xl text-foreground">{recipe.prepTime}m</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("prepTime")}</span>
              </div>
            )}
            {recipe.cookTime !== null && (
              <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[80px]">
                <span className="font-display font-bold text-xl text-foreground">{recipe.cookTime}m</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("cookTime")}</span>
              </div>
            )}
            {totalTime > 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[80px]">
                <span className="font-display font-bold text-xl text-foreground">{totalTime}m</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Total</span>
              </div>
            )}
            <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[80px]">
              <span className="font-display font-bold text-xl text-foreground">{selectedPortions}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("servings")}</span>
            </div>
          </div>

          {/* Adjust Servings */}
          <div className="flex items-center justify-between bg-card border border-border/60 rounded-xl px-5 py-3.5 shadow-sm">
            <span className="text-sm font-bold text-foreground">{t("portions.adjustServings")}</span>
            <div className="flex items-center gap-2">
              <button
                className="h-8 w-8 rounded-lg border border-border/80 flex items-center justify-center text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                onClick={() => setSelectedPortions((p) => Math.max(1, p - 1))}
                disabled={selectedPortions <= 1}
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-sm font-bold font-display tabular-nums">
                {selectedPortions}
              </span>
              <button
                className="h-8 w-8 rounded-lg border border-border/80 flex items-center justify-center text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                onClick={() => setSelectedPortions((p) => Math.min(20, p + 1))}
                disabled={selectedPortions >= 20}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <RecipeFavoriteButton
              recipeId={recipe.id}
              initialFavorited={isFavorited}
              showText
              compact
            />
            <Button
              className="bg-brand-500 hover:bg-brand-600 text-white border-0"
              disabled
            >
              <Star className="h-4 w-4 mr-2" />
              Add to Plan
            </Button>
            {isOwner && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => openEdit(recipe.id, recipeToFormData(recipe))}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Source Attribution */}
          {(() => {
            const source = recipe.source;
            const sourceUrl = recipe.sourceUrl;

            if (source === "url" && sourceUrl) {
              let hostname = sourceUrl;
              try { hostname = new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch {}
              return (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  <span>{t("source.importedFrom")}</span>
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 font-medium transition-colors border-b border-primary/30 hover:border-primary truncate max-w-[200px]"
                  >
                    {hostname}
                  </a>
                </div>
              );
            }

            if (source === "imported" || source === "document") {
              const fileName = sourceUrl || t("source.uploadedFile");
              return (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>{t("source.importedFrom")}</span>
                  <span className="font-medium text-foreground/80 truncate max-w-[200px]">{fileName}</span>
                </div>
              );
            }

            return (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PenLine className="h-3.5 w-3.5 shrink-0" />
                <span>{t("source.manual")}</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Bottom Section: Ingredients + Instructions */}
      <RecipeScalableContent
        ingredients={recipe.ingredients}
        multiplier={multiplier}
        servings={selectedPortions}
      >
        <InstructionsList instructions={recipe.instructions} />

        <MacroDisplay
          calories={recipe.calories}
          protein={recipe.protein}
          carbs={recipe.carbs}
          fat={recipe.fat}
          fiber={recipe.fiber}
          servings={selectedPortions}
        />


      </RecipeScalableContent>
    </PageContainer>
  );
}
