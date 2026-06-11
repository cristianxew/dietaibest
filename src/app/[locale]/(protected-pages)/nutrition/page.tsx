import { getTranslations } from "next-intl/server";
import {
  GraduationCap,
  Swords,
  CircleGauge,
  BookOpenText,
  Repeat,
  Calculator,
  CalendarRange,
} from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { ModuleCard } from "@/components/nutrition-hub/ModuleCard";
import { FeaturedFaceOff } from "@/components/nutrition-hub/FeaturedFaceOff";

export default async function NutritionHubPage() {
  const t = await getTranslations("nutritionHub.hub");

  const modules = [
    {
      href: "/nutrition/my-week",
      icon: CalendarRange,
      accent: "sage" as const,
      kicker: t("modules.myWeek.kicker"),
      title: t("modules.myWeek.title"),
      blurb: t("modules.myWeek.blurb"),
    },
    {
      href: "/nutrition/compare",
      icon: Swords,
      accent: "brand" as const,
      kicker: t("modules.compare.kicker"),
      title: t("modules.compare.title"),
      blurb: t("modules.compare.blurb"),
    },
    {
      href: "/nutrition/vs-day",
      icon: CircleGauge,
      accent: "sage" as const,
      kicker: t("modules.vsDay.kicker"),
      title: t("modules.vsDay.title"),
      blurb: t("modules.vsDay.blurb"),
    },
    {
      href: "/nutrition/nutrients",
      icon: BookOpenText,
      accent: "gold" as const,
      kicker: t("modules.nutrients.kicker"),
      title: t("modules.nutrients.title"),
      blurb: t("modules.nutrients.blurb"),
    },
    {
      href: "/nutrition/swaps",
      icon: Repeat,
      accent: "brand" as const,
      kicker: t("modules.swaps.kicker"),
      title: t("modules.swaps.title"),
      blurb: t("modules.swaps.blurb"),
    },
    {
      href: "/nutrition/calculator",
      icon: Calculator,
      accent: "stone" as const,
      kicker: t("modules.calculator.kicker"),
      title: t("modules.calculator.title"),
      blurb: t("modules.calculator.blurb"),
    },
  ];

  return (
    <div className="min-h-screen relative bg-background">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-sage-100/20 dark:bg-sage-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        {/* Header */}
        <div className="space-y-3 animate-fade-up">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
              <GraduationCap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
              {t("kicker")}
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground max-w-lg leading-relaxed">
            {t("description")}
          </p>
        </div>

        {/* Today's Face-Off teaser */}
        <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
          <FeaturedFaceOff />
        </div>

        {/* Module grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module, i) => (
            <ModuleCard
              key={module.href}
              {...module}
              className="animate-fade-up"
              style={{ animationDelay: `${150 + i * 75}ms` }}
            />
          ))}
        </div>
      </PageContainer>
    </div>
  );
}
