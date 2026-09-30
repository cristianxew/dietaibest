import { getTranslations } from "next-intl/server";
import { getRecipe } from "@/actions/recipe";
import { notFound } from "next/navigation";
import { resolveRecipeBackLink } from "@/lib/recipe-back-link";
import { RecipeDetailClient } from "../../../../../components/recipes/RecipeDetailClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { data: recipe } = await getRecipe(id);
  const t = await getTranslations({ locale, namespace: "recipes" });

  if (!recipe) {
    return { title: t("notFound") };
  }

  return {
    title: `${recipe.title} - ${t("title")}`,
    description: recipe.description || t("description"),
  };
}

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { locale, id } = await params;
  const { data: recipe, error } = await getRecipe(id);

  if (error || !recipe) {
    notFound();
  }

  // Back goes to the page the recipe was opened from (e.g. the meal plan), not always the library
  const backLink = resolveRecipeBackLink(locale, await searchParams);
  const tRecipes = await getTranslations({ locale, namespace: "recipes" });
  const backLabel = {
    recipes: () => tRecipes("backToRecipes"),
    dashboard: () => tRecipes("backToDashboard"),
    "meal-plans": async () => (await getTranslations({ locale, namespace: "mealPlans" }))("backToMealPlans"),
    previous: async () => (await getTranslations({ locale, namespace: "common" }))("back"),
  }[backLink.target];

  const isOwner = recipe.viewerIsOwner;
  const isFavorited = recipe.favoritedBy.length > 0;

  return (
    <RecipeDetailClient
      recipe={recipe}
      isOwner={isOwner}
      isFavorited={isFavorited}
      locale={locale}
      authorName={recipe.authorName}
      backHref={backLink.href}
      backLabel={await backLabel()}
    />
  );
}
