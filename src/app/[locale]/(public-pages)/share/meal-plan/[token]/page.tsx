import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, Flame, Utensils } from "lucide-react";
import { getMealPlanByShareToken } from "@/actions/meal-plan";
import { MEAL_SLOT_META } from "@/lib/meal-slot-meta";
import type { MealType } from "@/types/meal-plan";

interface SharedMealPlanPageProps {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: SharedMealPlanPageProps) {
  const { token } = await params;
  const { data: plan } = await getMealPlanByShareToken(token);
  return { title: plan ? `${plan.name} - DietAI` : "DietAI" };
}

export default async function SharedMealPlanPage({
  params,
}: SharedMealPlanPageProps) {
  const { locale, token } = await params;
  const { data: plan } = await getMealPlanByShareToken(token);

  if (!plan) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "mealPlans" });

  const mealTypeLabel = (mealType: string) => {
    const meta = MEAL_SLOT_META[mealType as MealType];
    return meta ? t(meta.i18nKey) : mealType;
  };

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Plan header */}
        <header className="bg-card border border-border rounded-xl px-6 py-5 space-y-3">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {plan.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("byAuthor", { author: plan.author })}
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {plan.duration}d
            </span>
            <span className="flex items-center gap-1">
              <Utensils className="w-3.5 h-3.5" />
              {plan.mealSlots.length}
              {t("perDay")}
            </span>
            {plan.targetCalories != null && (
              <span className="flex items-center gap-1 text-brand-500">
                <Flame className="w-3.5 h-3.5" />
                {plan.targetCalories} kcal
              </span>
            )}
          </div>
        </header>

        {/* Day-by-day read-only list */}
        <div className="space-y-4">
          {plan.days.map((day) => (
            <section
              key={day.id}
              className="bg-card border border-border rounded-xl px-6 py-4"
            >
              <h2 className="font-display text-sm font-semibold text-brand-500 uppercase tracking-widest mb-3">
                {t("shareDayLabel", { number: day.dayNumber })}
              </h2>
              <ul className="space-y-2">
                {day.meals.map((meal) => (
                  <li
                    key={meal.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-muted-foreground w-32 flex-shrink-0">
                      {mealTypeLabel(meal.mealType)}
                    </span>
                    <span className="flex-1 text-foreground truncate">
                      {meal.recipe?.title ?? "—"}
                    </span>
                    {meal.recipe?.calories != null && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {Math.round(meal.recipe.calories)} kcal
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Sign-up CTA */}
        <footer className="bg-card border border-border rounded-xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("shareCta")}</p>
          <Link
            href={`/${locale}/sign-up`}
            className="px-5 py-2.5 rounded-lg bg-brand-500 text-[#1C1A17] text-sm font-semibold hover:opacity-90 transition-opacity flex-shrink-0"
          >
            {t("shareCtaButton")}
          </Link>
        </footer>
      </div>
    </main>
  );
}
