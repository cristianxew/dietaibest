import { getTranslations } from "next-intl/server";
import { getRecipe } from "@/actions/recipe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Users, ChefHat, Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { RecipeDeleteButton } from "../../../../../components/recipes/RecipeDeleteButton";
import { RecipeFavoriteButton } from "../../../../../components/recipes/RecipeFavoriteButton";
import { MacroDisplay } from "../../../../../components/recipes/MacroDisplay";
import { IngredientsList } from "../../../../../components/recipes/IngredientsList";
import { InstructionsList } from "../../../../../components/recipes/InstructionsList";

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
    title: `${recipe.title} - ${t("title")}`,
    description: recipe.description || t("description"),
  };
}

export default async function RecipeDetailPage({
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

  const isOwner = recipe.userId === recipe.user.id;
  const isFavorited = recipe.favoritedBy.length > 0;

  return (
    <div className="container mx-auto py-8">
      {/* Header Navigation */}
      <div className="mb-6">
        <Link href={`/${locale}/recipes`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToRecipes")}
          </Button>
        </Link>
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left Side */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recipe Header */}
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <h1 className="text-3xl font-bold">{recipe.title}</h1>
                    {recipe.description && (
                      <p className="text-muted-foreground">
                        {recipe.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <RecipeFavoriteButton
                      recipeId={recipe.id}
                      initialFavorited={isFavorited}
                    />
                    {isOwner && (
                      <>
                        <Link href={`/${locale}/recipes/${id}/edit`}>
                          <Button variant="outline" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <RecipeDeleteButton
                          recipeId={recipe.id}
                          recipeName={recipe.title}
                        />
                      </>
                    )}
                  </div>
                </div>

                {/* Recipe Meta Info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  {recipe.prepTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {t("prepTime")}: {recipe.prepTime} {t("minutes")}
                      </span>
                    </div>
                  )}
                  {recipe.cookTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {t("cookTime")}: {recipe.cookTime} {t("minutes")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {recipe.servings} {t("servings")}
                    </span>
                  </div>
                  {recipe.difficulty && (
                    <div className="flex items-center gap-1">
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                      <Badge variant="secondary">
                        {t(`difficulty.${recipe.difficulty}`)}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Categories and Tags */}
                {(recipe.categories.length > 0 || recipe.tags.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {recipe.categories.map((category) => (
                      <Badge key={category.id} variant="outline">
                        {category.name}
                      </Badge>
                    ))}
                    {recipe.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>

              {/* Recipe Image */}
              {recipe.imageUrl && (
                <div className="relative w-full h-96 overflow-hidden">
                  <Image
                    src={recipe.imageUrl}
                    alt={recipe.title}
                    fill
                    className="object-cover"
                  />
                </div>
              )}

              <CardContent className="space-y-6 pt-6">
                {/* Ingredients */}
                <IngredientsList ingredients={recipe.ingredients} />

                {/* Instructions */}
                <InstructionsList instructions={recipe.instructions} />

                {/* Source Information */}
                {recipe.sourceUrl && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      {t("source")}:{" "}
                      <a
                        href={recipe.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {recipe.sourceUrl}
                      </a>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Right Side */}
          <div className="space-y-6">
            {/* Nutrition Information */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">
                  {t("nutritionPerServing")}
                </h2>
              </CardHeader>
              <CardContent>
                <MacroDisplay
                  calories={recipe.calories}
                  protein={recipe.protein}
                  carbs={recipe.carbs}
                  fat={recipe.fat}
                  fiber={recipe.fiber}
                  sugar={recipe.sugar}
                  sodium={recipe.sodium}
                />
              </CardContent>
            </Card>

            {/* Quick Actions (mobile duplicate) */}
            <div className="lg:hidden">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col gap-3">
                    <RecipeFavoriteButton
                      recipeId={recipe.id}
                      initialFavorited={isFavorited}
                      showText
                    />
                    {isOwner && (
                      <>
                        <Link href={`/${locale}/recipes/${id}/edit`}>
                          <Button variant="outline" className="w-full">
                            <Edit className="h-4 w-4 mr-2" />
                            {t("editRecipe")}
                          </Button>
                        </Link>
                        <RecipeDeleteButton
                          recipeId={recipe.id}
                          recipeName={recipe.title}
                          showText
                        />
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
