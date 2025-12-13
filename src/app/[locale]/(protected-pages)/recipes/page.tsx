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
    <div className="min-h-screen">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-background to-gold-50/30 dark:from-brand-950/30 dark:via-background dark:to-gold-950/20">
        {/* Decorative blobs */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-200/30 dark:bg-brand-800/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold-200/40 dark:bg-gold-800/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />

        <div className="container mx-auto px-4 py-10 relative z-10">
          {/* Top row: Title + Add button */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-display font-semibold tracking-tight text-foreground">
                {t("title")}
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl">
                {t("description")}
              </p>
            </div>

            <Button
              asChild
              size="lg"
              className="bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 transition-all duration-300 hover:-translate-y-0.5 rounded-xl"
            >
              <Link href={`/${locale}/recipes/new`}>
                <Plus className="mr-2 h-5 w-5" />
                {t("addRecipe")}
              </Link>
            </Button>
          </div>

          {/* Stats bar */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <RecipeStats />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative p-6 lg:p-8 space-y-8">
        <RecipesList />
      </div>
    </div>
  );
}
