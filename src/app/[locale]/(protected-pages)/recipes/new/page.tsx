"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChefHat, Sparkles } from "lucide-react";
import Link from "next/link";
import { RecipeForm } from "../../../../../components/recipes/RecipeForm";
import { RecipeImport } from "../../../../../components/recipes/RecipeImport";
import { useLocale } from "next-intl";
import { RecipeFormData } from "@/types/recipe";
import { cn } from "@/lib/utils";

interface ImportedRecipeData {
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  imageUrl?: string;
  difficulty?: string;
  cuisine?: string;
  tags?: string[];
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
}

export default function NewRecipePage() {
  const t = useTranslations("recipes");
  const locale = useLocale();
  const [showImport, setShowImport] = useState(true);
  const [importedData, setImportedData] = useState<RecipeFormData | undefined>(
    undefined
  );

  const handleImportComplete = useCallback((recipeData: ImportedRecipeData) => {
    // Transform imported data to match RecipeFormData structure
    const transformedData: RecipeFormData = {
      title: recipeData.title,
      description: recipeData.description || "",
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      prepTime: recipeData.prepTime,
      cookTime: recipeData.cookTime,
      servings: recipeData.servings || 1,
      difficulty: recipeData.difficulty?.toLowerCase() as
        | "easy"
        | "medium"
        | "hard"
        | undefined,
      imageUrl: recipeData.imageUrl || "",
      tags: [
        ...(recipeData.tags || []),
        ...(recipeData.cuisine ? [recipeData.cuisine] : []),
      ].filter(Boolean),
      categoryIds: [],
      isPublic: false,
      calories: recipeData.calories,
      protein: recipeData.protein,
      carbs: recipeData.carbs,
      fat: recipeData.fat,
      fiber: recipeData.fiber,
      sugar: recipeData.sugar,
      sodium: recipeData.sodium,
    };

    setImportedData(transformedData);
    setShowImport(false);
  }, []);

  const handleSkipImport = useCallback(() => {
    setShowImport(false);
  }, []);

  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none sticky top-0">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Navigation & Header */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href={`/${locale}/recipes`}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("backToRecipes")}
              </Button>
            </Link>
          </div>

          <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end border-b border-border/40 pb-8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
                  <ChefHat className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                </div>
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                  {t("addRecipe")}
                </span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
                {showImport ? t("importOrCreate") : t("recipeDetails")}
              </h1>
              <p className="text-muted-foreground max-w-lg leading-relaxed">
                {showImport
                  ? t("importDescription", { default: "Import a recipe from a URL, image, or PDF, or start from scratch." })
                  : t("createDescription", { default: "Fill in the details below to create your new culinary masterpiece." })
                }
              </p>
            </div>

            {!showImport && (
              <Button
                variant="outline"
                onClick={() => setShowImport(true)}
                className="gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {t("importDifferent")}
              </Button>
            )}
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {showImport ? (
            <div className="max-w-4xl mx-auto">
              <RecipeImport
                onImportComplete={handleImportComplete}
                onSkipImport={handleSkipImport}
              />
            </div>
          ) : (
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 shadow-sm">
              <RecipeForm mode="create" recipe={importedData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
