import { getTranslations } from "next-intl/server";
import { getRecipe } from "@/actions/recipe";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecipeForm } from "../../../../../../components/recipes/RecipeForm";
import type { RecipeFormData } from "@/types/recipe";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { data: recipe } = await getRecipe(id);
  const t = await getTranslations({ locale, namespace: "recipes" });

  if (!recipe) {
    return {
      title: t("notFound"),
    };
  }

  return {
    title: `${t("editRecipe")} - ${recipe.title}`,
  };
}

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "recipes" });
  const { data: recipe, error } = await getRecipe(id);

  if (error || !recipe) {
    notFound();
  }

  // Transform the recipe data to match the form format
  const formData: RecipeFormData & { id: string } = {
    id: recipe.id,
    title: recipe.title,
    description: recipe.description || "",
    imageUrl: recipe.imageUrl || "",
    prepTime: recipe.prepTime || undefined,
    cookTime: recipe.cookTime || undefined,
    servings: recipe.servings,
    difficulty: recipe.difficulty as "easy" | "medium" | "hard" | undefined,
    ingredients: Array.isArray(recipe.ingredients)
      ? recipe.ingredients
      : JSON.parse((recipe.ingredients as string) || "[]"),
    instructions: recipe.instructions,
    tags: recipe.tags,
    categoryIds: recipe.categories.map((cat) => cat.id),
    isPublic: recipe.isPublic,
    calories: recipe.calories || undefined,
    protein: recipe.protein || undefined,
    carbs: recipe.carbs || undefined,
    fat: recipe.fat || undefined,
    fiber: recipe.fiber || undefined,
    sugar: recipe.sugar || undefined,
    sodium: recipe.sodium || undefined,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/${locale}/recipes/${id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToRecipe")}
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">
          {t("editRecipe")}
        </h1>

        <RecipeForm mode="edit" recipe={formData} />
      </div>
    </div>
  );
}
