import { getTranslations } from "next-intl/server";
import { RecipesList } from "../../../../components/recipes/RecipesList";
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

      {/* Tighter gutters on phones; RecipesList's full-bleed sticky toolbar mirrors these paddings */}
      <PageContainer className="px-4 py-5 sm:p-6 lg:p-10 space-y-4 sm:space-y-6">
        {/* Header — below lg the "Add recipe" action sits here instead of in the toolbar */}
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl lg:text-[2rem] font-display font-bold text-foreground tracking-tight">
              {t("title") || "My Recipes"}
            </h1>
          </div>
          <AddRecipeButton label={t("addRecipe")} className="lg:hidden shrink-0" />
        </div>

        {/* Main Content */}
        <RecipesList initialViewMode={view as "grid" | "list"} />
      </PageContainer>
    </div>
  );
}
