import { getTranslations } from "next-intl/server";
import { RecipesList } from "../../../../components/recipes/RecipesList";
import { PageContainer } from "@/components/ui/page-container";

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
        <div className="flex flex-col justify-between items-start gap-1">
          <div>
            <span className="text-xs tracking-widest text-brand-500 uppercase mb-1">
              Recipe Library
            </span>
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
              {t("title") || "My Recipes"}
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <RecipesList initialViewMode={view as "grid" | "list"} />
      </PageContainer>
    </div>
  );
}
