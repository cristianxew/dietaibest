import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { MealPlanner } from "@/components/meal-plans/MealPlanner";
import { getUserProfile } from "@/actions/profile";
import { getReferenceIntakes } from "@/lib/nutrition-rda";

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

  // Resolve micronutrient reference intakes once on the server: personalized by
  // the user's age + sex when a profile exists, otherwise standard FDA Daily
  // Values. Passed to the planner so the micronutrient panels can show %DV.
  const { data: profile } = await getUserProfile();
  const reference = getReferenceIntakes(
    profile ? { dateOfBirth: profile.dateOfBirth, gender: profile.gender } : null
  );

  return (
    <Suspense>
      <MealPlanner reference={reference} />
    </Suspense>
  );
}
