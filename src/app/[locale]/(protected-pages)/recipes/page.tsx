import { getTranslations } from "next-intl/server";
import { RecipesList } from "../../../../components/recipes/RecipesList";
import { RecipeStats } from "../../../../components/recipes/RecipeStats";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recipes" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "recipes" });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("description")}</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/recipes/new`}>
            <Plus className="mr-2 h-4 w-4" />
            {t("addRecipe")}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <RecipesList />
        </div>
        <div className="lg:col-span-1">
          <RecipeStats />
        </div>
      </div>
    </div>
  );
}
