import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { getDashboardData, getTodaysMacros } from "@/actions/dashboard";
import { PageContainer } from "@/components/ui/page-container";
import { HeroCTA } from "@/components/dashboard/HeroCTA";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { InteractiveDashboardGrid } from "@/components/dashboard/InteractiveDashboardGrid";
import { DashboardSkeleton } from "@/components/dashboard/skeletons/DashboardSkeleton";
import { AssistantCapabilityCard } from "@/components/dashboard/AssistantCapabilityCard";
import { getDashboardState, shouldShowHeroCTA } from "@/lib/dashboard-state";

// Main dashboard content component
async function DashboardContent() {
  const [dashboardResult, macrosResult] = await Promise.all([
    getDashboardData(),
    getTodaysMacros(),
  ]);

  const data = dashboardResult.data;
  const todaysMacros = macrosResult.data;

  if (!data) {
    const t = await getTranslations("dashboard");
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t("loadError")}</p>
      </div>
    );
  }

  const {
    profile,
    recipeStats,
    mealPlanStats,
    recentRecipes,
    activePlan,
    weeklyMacros,
    targets,
    isPro,
  } = data;

  const hasRecipes = (recipeStats?.totalRecipes || 0) > 0;
  const hasMealPlans = (mealPlanStats?.totalTemplates || 0) > 0;
  const hasActivePlan = !!activePlan;
  const profileComplete = profile?.onboardingCompleted || false;

  // Determine dashboard state for smart CTA display
  const dashboardState = getDashboardState({
    profileComplete,
    hasRecipes,
    hasMealPlans,
    hasActivePlan,
  });

  const showHeroCTA = shouldShowHeroCTA(dashboardState);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 slide-in-from-bottom-4">
      <WelcomeHeader
        hasRecipes={hasRecipes}
        hasMealPlans={hasMealPlans}
        isPro={isPro}
      />

      {/* Next-step banner - smart empty state based on user journey */}
      {showHeroCTA && (
        <HeroCTA
          dashboardState={dashboardState}
          recipeCount={recipeStats?.totalRecipes || 0}
          mealPlanCount={mealPlanStats?.totalTemplates || 0}
        />
      )}

      {/* AI Assistant discovery popup */}
      <AssistantCapabilityCard />

      {/* Main Content Grid */}
      <InteractiveDashboardGrid
        todaysMacros={todaysMacros}
        weeklyMacros={weeklyMacros}
        activePlan={activePlan}
        targets={targets}
        recentRecipes={recentRecipes}
        hasActivePlan={hasActivePlan}
      />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Premium Ambient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      {/* Main Content. The bottom padding clears the floating chat button
          (design_system.md → "Floating chat button"). */}
      <PageContainer className="z-10 pb-[calc(env(safe-area-inset-bottom)+6rem)] lg:pb-24">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </PageContainer>
    </div>
  );
}
