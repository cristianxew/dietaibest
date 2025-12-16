import { getTranslations } from "next-intl/server";
import { RecipesList } from "../../../../components/recipes/RecipesList";
import { RecipeStats } from "../../../../components/recipes/RecipeStats";
import { Button } from "@/components/ui/button";
import { Plus, Utensils } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    <div className="min-h-screen bg-background relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8">
        {/* Hero Header */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
                <Utensils className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                {t("title")}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground max-w-lg leading-relaxed">
              {t("description")}
            </p>
          </div>

          <Button
            asChild
            className={cn(
              "gap-2 h-11 px-6 shadow-lg shadow-brand-500/20",
              "bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700",
              "transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
            )}
          >
            <Link href={`/${locale}/recipes/new`}>
              <Plus className="w-4 h-4" />
              {t("addRecipe")}
            </Link>
          </Button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <RecipeStats />
        </div>

        {/* Main Content */}
        <RecipesList />
      </div>
    </div>
  );
}
