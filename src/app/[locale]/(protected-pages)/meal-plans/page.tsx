import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { MealPlanner } from "@/components/meal-plans/MealPlanner";

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
  await params;
  return (
    <Suspense>
      <MealPlanner />
    </Suspense>
  );
}
