import { getTranslations } from "next-intl/server";
import MealPlans from "@/components/MealPlans";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "mealPlans" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function MealPlansPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params; // Required for Next.js params resolution

  return <MealPlans />;
}
