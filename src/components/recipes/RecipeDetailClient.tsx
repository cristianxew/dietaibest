"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import type { Prisma } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Star, Minus, Plus, ExternalLink, FileText, PenLine, ChefHat, Camera, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page-container";
import { RecipeFavoriteButton } from "./RecipeFavoriteButton";
import { RecipeDeleteButton } from "./RecipeDeleteButton";
import { RecipeScalableContent } from "./RecipeScalableContent";
import { InstructionsList } from "./InstructionsList";
import { MacroDisplay } from "./MacroDisplay";
import { AskDietAIButton } from "@/components/chat/AskDietAIButton";
import { selectCapabilitiesForPath } from "@/lib/chat/capabilities";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { recipeToFormData } from "@/lib/recipe-utils";
import { toast } from "sonner";

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
    sugar?: number | null;
    sodium?: number | null;
    cholesterol?: number | null;
    saturatedFat?: number | null;
    transFat?: number | null;
    vitaminA?: number | null;
    vitaminC?: number | null;
    vitaminD?: number | null;
    vitaminE?: number | null;
    vitaminK?: number | null;
    vitaminB12?: number | null;
    folate?: number | null;
    iron?: number | null;
    calcium?: number | null;
    magnesium?: number | null;
    potassium?: number | null;
    zinc?: number | null;
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
  authorName?: string;
}

const difficultyBadgeClass: Record<string, string> = {
  easy: "border-sage-300 text-sage-600 dark:border-sage-700 dark:text-sage-400",
  medium: "border-gold-300 text-gold-600 dark:border-gold-700 dark:text-gold-400",
  hard: "border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400",
};

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

export function RecipeDetailClient({
  recipe,
  isOwner,
  isFavorited,
  locale,
  authorName,
}: RecipeDetailClientProps) {
  const t = useTranslations("recipes");
  const tChat = useTranslations("chat");
  const tCaps = useTranslations("chat.capabilities");
  const [selectedPortions, setSelectedPortions] = useState(recipe.servings);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(recipe.imageUrl);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openEdit } = useRecipeModal();

  const multiplier = selectedPortions / recipe.servings;
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
  const askCapabilities = selectCapabilitiesForPath(
    `/${locale}/recipes/${recipe.id}`,
    locale,
    3
  );
  const showImage = Boolean(currentImageUrl && !imageError);
  const primaryCategory = recipe.categories[0]?.name || 'DINNER';
  const styles = getCategoryStyles(primaryCategory);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("imageUpdateError") + ": File size exceeds 10MB");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/recipes/${recipe.id}/image`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error?.message || "Upload failed");
      }

      const data = await response.json();
      setCurrentImageUrl(data.imageUrl);
      setImageError(false);
      toast.success(t("imageUpdated"));
    } catch (error: any) {
      console.error("[RecipeDetailClient] Failed to upload image:", error);
      toast.error(t("imageUpdateError") + (error.message ? `: ${error.message}` : ""));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDeleteImage = async () => {
    if (!confirm(t("deleteImage") + "?")) return;

    setIsUploading(true);
    try {
      const response = await fetch(`/api/recipes/${recipe.id}/image`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error?.message || "Delete failed");
      }

      setCurrentImageUrl(null);
      setImageError(false);
      toast.success(t("imageDeleted"));
    } catch (error: any) {
      console.error("[RecipeDetailClient] Failed to delete image:", error);
      toast.error(t("imageDeleteError") + (error.message ? `: ${error.message}` : ""));
    } finally {
      setIsUploading(false);
    }
  };

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
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-xl shadow-stone-900/5 border border-black/5 dark:border-white/10 group">
              <Image
                src={currentImageUrl!}
                alt={recipe.title}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                priority
                onError={() => setImageError(true)}
              />
              {isOwner && (
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 backdrop-blur-[2px] z-10">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium text-sm border border-white/20 backdrop-blur-md transition-all active:scale-95 shadow-lg shadow-black/10"
                  >
                    <Camera className="h-4 w-4" />
                    {t("editImage")}
                  </button>
                  <button
                    onClick={handleDeleteImage}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-100 font-medium text-sm border border-red-500/20 backdrop-blur-md transition-all active:scale-95 shadow-lg shadow-black/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("deleteImage")}
                  </button>
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 transition-all duration-300 z-20">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                  <span className="text-sm font-semibold text-white tracking-wide">
                    {t("uploadingImage")}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div
              className={cn(
                "aspect-[4/3] w-full rounded-2xl border border-border/60 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 shadow-xl shadow-stone-900/5 group",
                styles.bg
              )}
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(0,0,0,0.02) 15px, rgba(0,0,0,0.02) 30px)`
              }}
            >
              <div className="flex flex-col items-center gap-4 text-center z-10 p-6 group-hover:scale-95 transition-transform duration-300">
                <div className={cn("h-16 w-16 rounded-full flex items-center justify-center bg-background border border-border/40 shadow-sm transition-transform duration-300 hover:scale-105", styles.text)}>
                  <ChefHat className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <span className={cn("text-xs font-bold tracking-[0.2em] uppercase", styles.text)}>
                    {primaryCategory}
                  </span>
                  <p className="text-xs text-muted-foreground font-medium max-w-[200px] leading-normal truncate px-2">
                    {recipe.title}
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/5" />
              {isOwner && (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-2 cursor-pointer backdrop-blur-[2px] z-20"
                >
                  <div className="h-12 w-12 rounded-full bg-white/20 border border-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-lg transition-transform hover:scale-110 active:scale-95">
                    <Camera className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-white tracking-wide">
                    {t("editImage")}
                  </span>
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 transition-all duration-300 z-30">
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                  <span className="text-sm font-semibold text-white tracking-wide">
                    {t("uploadingImage")}
                  </span>
                </div>
              )}
            </div>
          )}
          {isOwner && (
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="hidden"
            />
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

          {/* Author attribution for public recipes viewed by non-owners */}
          {!isOwner && authorName && (
            <p className="text-sm text-muted-foreground">
              {t("byAuthor", { author: authorName })}
            </p>
          )}

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
                <span className="font-bold text-xl text-foreground">{recipe.prepTime}m</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("prepTime")}</span>
              </div>
            )}
            {recipe.cookTime !== null && (
              <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[80px]">
                <span className="font-bold text-xl text-foreground">{recipe.cookTime}m</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("cookTime")}</span>
              </div>
            )}
            {totalTime > 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[80px]">
                <span className="font-bold text-xl text-foreground">{totalTime}m</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">Total</span>
              </div>
            )}
            <div className="flex flex-col items-center justify-center px-6 py-3 min-w-[80px]">
              <span className="font-bold text-xl text-foreground">{selectedPortions}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5">{t("servings")}</span>
            </div>
          </div>

          {/* Ask DietAI */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {tChat("entry.recipeDetail.ask")}
            </span>
            {askCapabilities.map((cap) => (
              <AskDietAIButton
                key={cap.id}
                prompt={tCaps(
                  cap.entityAware ? `${cap.id}.entityPrompt` : `${cap.id}.prompt`
                )}
              >
                {tCaps(`${cap.id}.label`)}
              </AskDietAIButton>
            ))}
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
              <>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => openEdit(recipe.id, recipeToFormData(recipe))}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <RecipeDeleteButton
                  recipeId={recipe.id}
                  recipeName={recipe.title}
                  showText={false}
                />
              </>
            )}
          </div>

          {/* Source Attribution */}
          {(() => {
            const source = recipe.source;
            const sourceUrl = recipe.sourceUrl;

            if (source === "url" && sourceUrl) {
              let hostname = sourceUrl;
              try { hostname = new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { }
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
      </RecipeScalableContent>
    </PageContainer>
  );
}
