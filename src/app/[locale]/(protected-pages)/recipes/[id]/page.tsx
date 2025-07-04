import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string; id: string };
}) {
  const t = await getTranslations({ locale, namespace: "recipes" });

  return {
    title: t("title"),
  };
}

export default async function RecipeDetailPage({
  params: { locale, id },
}: {
  params: { locale: string; id: string };
}) {
  const t = await getTranslations({ locale, namespace: "recipes" });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href={`/${locale}/recipes`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("backToDashboard")}
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
          <p className="text-muted-foreground">
            Recipe details page coming soon...
          </p>
          <p className="text-sm text-muted-foreground mt-2">Recipe ID: {id}</p>
        </div>
      </div>
    </div>
  );
}
