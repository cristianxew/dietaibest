"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { RecipeForm } from "../../../../../components/recipes/RecipeForm";
import { RecipeImport } from "../../../../../components/recipes/RecipeImport";
import { useLocale } from "next-intl";
import { RecipeFormData } from "@/types/recipe";

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
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <Link href={`/${locale}/recipes`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToRecipes")}
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        {showImport ? (
          <RecipeImport
            onImportComplete={handleImportComplete}
            onSkipImport={handleSkipImport}
          />
        ) : (
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-8">
              {t("addRecipe")}
            </h1>
            <RecipeForm mode="create" recipe={importedData} />
          </div>
        )}
      </div>
    </div>
  );
}
