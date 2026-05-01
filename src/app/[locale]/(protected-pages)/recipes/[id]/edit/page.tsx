import { getRecipe } from "@/actions/recipe";
import { notFound } from "next/navigation";
import { EditRedirectShell } from "./EditRedirectShell";
import { recipeToFormData } from "@/lib/recipe-utils";
import { getTranslations } from "next-intl/server";

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
  const { data: recipe, error } = await getRecipe(id);

  if (error || !recipe) {
    notFound();
  }

  const formData = recipeToFormData(recipe);

  return <EditRedirectShell recipeId={id} locale={locale} formData={formData} />;
}
