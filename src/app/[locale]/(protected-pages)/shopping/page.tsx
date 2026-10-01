import { getTranslations } from "next-intl/server";
import { ShoppingListPage } from "@/components/shopping";
import { PageContainer } from "@/components/ui/page-container";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shopping" });

  return {
    title: t("title"),
    description: t("subtitle"),
  };
}

export default async function ShoppingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "shopping" });

  return (
    <div className="min-h-screen relative bg-background">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        {/* Hero Header */}
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
          <div className="space-y-3">
            <h1 className="text-3xl lg:text-[2rem] font-display font-bold text-foreground tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground max-w-lg leading-relaxed">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <ShoppingListPage />
      </PageContainer>
    </div>
  );
}
