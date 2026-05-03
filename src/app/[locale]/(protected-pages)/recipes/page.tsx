import { getTranslations } from "next-intl/server";
import { RecipesList } from "../../../../components/recipes/RecipesList";
import { LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page-container";
import { AddRecipeButton } from "@/components/recipes/AddRecipeButton";

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
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale } = await params;
  const resolvedParams = await searchParams;
  const view = (resolvedParams.view as string) || "grid";
  const t = await getTranslations({ locale, namespace: "recipes" });

  return (
    <div className="min-h-screen bg-background relative pb-20">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <span className="text-xs tracking-widest text-brand-500 uppercase mb-1">
              Recipe Library
            </span>
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
              {t("title") || "My Recipes"}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center border border-border/60 rounded-lg p-1 bg-card">
              <Link
                href={`/${locale}/recipes?view=grid`}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  view === 'grid' ? "bg-brand-50 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </Link>
              <Link
                href={`/${locale}/recipes?view=list`}
                className={cn(
                  "p-2 rounded-md transition-colors",
                  view === 'list' ? "bg-brand-50 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400" : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                <List className="w-4 h-4" />
              </Link>
            </div>
            <AddRecipeButton label={t("addRecipe")} />
          </div>
        </div>

        {/* Main Content */}
        <RecipesList viewMode={view as "grid" | "list"} />
      </PageContainer>
    </div>
  );
}
