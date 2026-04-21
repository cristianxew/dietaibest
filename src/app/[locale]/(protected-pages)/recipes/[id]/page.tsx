import { getTranslations } from "next-intl/server";
import { getRecipe } from "@/actions/recipe";
import { notFound } from "next/navigation";
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
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { data: recipe, error } = await getRecipe(id);

  if (error || !recipe) {
    notFound();
  }

  const isOwner = recipe.userId === recipe.user.id;
  const isFavorited = recipe.favoritedBy.length > 0;

  return (
    <RecipeDetailClient
      recipe={recipe}
      isOwner={isOwner}
      isFavorited={isFavorited}
      locale={locale}
    />
  );
}
