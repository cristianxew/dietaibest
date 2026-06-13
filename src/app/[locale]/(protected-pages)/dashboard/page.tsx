import { Suspense } from "react";
import { getDashboardData, getTodaysMacros } from "@/actions/dashboard";
import { PageContainer } from "@/components/ui/page-container";
import { HeroCTA } from "@/components/dashboard/HeroCTA";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { InteractiveDashboardGrid } from "@/components/dashboard/InteractiveDashboardGrid";
import { DashboardSkeleton } from "@/components/dashboard/skeletons/DashboardSkeleton";
import { AssistantCapabilityCard } from "@/components/dashboard/AssistantCapabilityCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load dashboard data.</p>
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
      {/* Hero CTA - Smart empty state based on user journey */}
      {showHeroCTA && (
        <HeroCTA
          dashboardState={dashboardState}
          recipeCount={recipeStats?.totalRecipes || 0}
          mealPlanCount={mealPlanStats?.totalTemplates || 0}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-end">
        <div className="flex-1 min-w-0">
          <WelcomeHeader
            hasRecipes={hasRecipes}
            hasMealPlans={hasMealPlans}
            hasActivePlan={hasActivePlan}
            profileComplete={profileComplete}
          />
        </div>

        {/* Quick Stats - Compact View */}
        <div className="hidden lg:block">
          <div className="flex gap-4 p-2 rounded-2xl bg-white/40 dark:bg-stone-900/40 backdrop-blur-md border border-stone-200/50 dark:border-stone-800/50 shadow-sm shadow-stone-200/10 dark:shadow-none">
            <div className="px-4 py-2 border-r border-stone-200/50 dark:border-stone-800/50 last:border-0">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Recipes</span>
              <span className="text-2xl font-display font-semibold text-foreground">{recipeStats?.totalRecipes || 0}</span>
            </div>
            <div className="px-4 py-2 border-r border-stone-200/50 dark:border-stone-800/50 last:border-0">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Plans</span>
              <span className="text-2xl font-display font-semibold text-foreground">{mealPlanStats?.totalTemplates || 0}</span>
            </div>
            <div className="px-4 py-2">
              <span className="block text-xs uppercase tracking-wider text-muted-foreground font-medium mb-1">Active</span>
              <span className="text-2xl font-display font-semibold text-foreground text-sage-600 dark:text-sage-400">{mealPlanStats?.activeSchedules || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full Width AI Assistant Panel */}
      <AssistantCapabilityCard />

      {/* Main Content Grid */}
      <InteractiveDashboardGrid
        todaysMacros={todaysMacros}
        weeklyMacros={weeklyMacros}
        activePlan={activePlan}
        profile={profile}
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

      {/* Main Content */}
      <PageContainer className="z-10">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </PageContainer>
    </div>
  );
}
