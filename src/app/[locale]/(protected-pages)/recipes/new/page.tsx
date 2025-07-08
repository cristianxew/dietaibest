"use client";

import { useState } from "react";
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
}

// Since we need to use client components for the import flow, we'll make this a client component
// and use useTranslations instead of getTranslations
export default function NewRecipePage() {
  const t = useTranslations("recipes");
  const locale = useLocale();
  const [showImport, setShowImport] = useState(true);
  const [importedData, setImportedData] = useState<
    (RecipeFormData & { id: string }) | undefined
  >(undefined);

  const handleImportComplete = (recipeData: ImportedRecipeData) => {
    // Transform imported data to match RecipeFormData structure
    const transformedData: RecipeFormData & { id: string } = {
      id: "temp-import", // Temporary ID for imported recipes
      title: recipeData.title,
      description: recipeData.description || "",
      ingredients: recipeData.ingredients,
      instructions: recipeData.instructions,
      prepTime: recipeData.prepTime,
      cookTime: recipeData.cookTime,
      servings: recipeData.servings || 1,
      // Set default values for required fields
      imageUrl: "",
      difficulty: undefined,
      tags: [],
      categoryIds: [],
      isPublic: false,
      calories: undefined,
      protein: undefined,
      carbs: undefined,
      fat: undefined,
      fiber: undefined,
      sugar: undefined,
      sodium: undefined,
    };

    setImportedData(transformedData);
    setShowImport(false);
  };

  const handleSkipImport = () => {
    setShowImport(false);
  };

  return (
    <div className="container mx-auto px-4 py-8">
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
          <>
            <h1 className="text-3xl font-bold tracking-tight mb-8">
              {t("addRecipe")}
            </h1>
            <RecipeForm mode="create" recipe={importedData} />
          </>
        )}
      </div>
    </div>
  );
}
