import { Suspense } from "react";
import { getDashboardData, getTodaysMacros } from "@/actions/dashboard";
import { OnboardingPrompt } from "@/components/dashboard/OnboardingPrompt";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { SmartQuickActions } from "@/components/dashboard/SmartQuickActions";
import {
  ActivePlanPreview,
  ActivePlanEmpty,
} from "@/components/dashboard/ActivePlanPreview";
import { WeeklyMacroChart } from "@/components/dashboard/WeeklyMacroChart";
import { RecentRecipesCarousel } from "@/components/dashboard/RecentRecipesCarousel";
import { GettingStartedSection } from "@/components/dashboard/GettingStartedSection";
import { DashboardSkeleton } from "@/components/dashboard/skeletons/DashboardSkeleton";
import { CompactNutrition } from "@/components/dashboard/CompactNutrition";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

  // Check if user is new (for getting started section)
  const isNewUser = !hasRecipes && !hasMealPlans;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 slide-in-from-bottom-4">
      {/* Onboarding Prompt */}
      <OnboardingPrompt />

      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end">
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column - Nutrition & Quick Actions */}
        <div className="lg:col-span-6 xl:col-span-5 space-y-6">
          {/* Compact Nutrition Card with Quick Actions on top */}
          <Card className="border-stone-200/70 dark:border-stone-800/70 bg-white/60 dark:bg-stone-900/60 backdrop-blur-xl overflow-hidden shadow-lg shadow-stone-200/20 dark:shadow-none">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 via-gold-400 to-sage-500 opacity-80" />

            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg font-display font-semibold tracking-tight">
                <span className="bg-gradient-to-br from-brand-500 to-gold-500 bg-clip-text text-transparent">
                  Today&apos;s Nutrition
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Quick Actions - Compact pills on top */}
              <SmartQuickActions
                hasRecipes={hasRecipes}
                hasMealPlans={hasMealPlans}
                hasActivePlan={hasActivePlan}
              />

              {/* Divider */}
              <div className="h-px bg-stone-200/60 dark:bg-stone-800/60" />

              {/* Compact Nutrition Display */}
              <CompactNutrition
                calories={todaysMacros?.calories || 0}
                protein={todaysMacros?.protein || 0}
                carbs={todaysMacros?.carbs || 0}
                fat={todaysMacros?.fat || 0}
                targetCalories={todaysMacros?.targetCalories || null}
                targetProtein={todaysMacros?.targetProtein || null}
                targetCarbs={todaysMacros?.targetCarbs || null}
                targetFat={todaysMacros?.targetFat || null}
                hasActivePlan={hasActivePlan}
              />
            </CardContent>
          </Card>

          {/* Weekly Progress */}
          <WeeklyMacroChart
            data={weeklyMacros}
            targetCalories={profile?.dailyCalories || null}
            targetProtein={profile?.proteinGrams || null}
            targetCarbs={profile?.carbsGrams || null}
            targetFat={profile?.fatGrams || null}
          />
        </div>

        {/* Right Column - Active Plan & Recent Recipes */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6">
          {/* Active Plan Card */}
          {hasActivePlan && activePlan ? (
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-br from-sage-300/30 to-brand-300/30 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
              <ActivePlanPreview
                templateId={activePlan.templateId}
                templateName={activePlan.templateName}
                startDate={activePlan.startDate}
                duration={activePlan.duration}
                currentDayNumber={activePlan.currentDayNumber}
                daysRemaining={activePlan.daysRemaining}
                todaysMeals={activePlan.todaysMeals}
              />
            </div>
          ) : (
            <ActivePlanEmpty />
          )}

          {/* Recent Recipes */}
          <RecentRecipesCarousel recipes={recentRecipes || []} />
        </div>
      </div>

      {/* Getting Started Section - only for new users */}
      {isNewUser && (
        <GettingStartedSection
          profileComplete={profileComplete}
          hasRecipes={hasRecipes}
          hasMealPlans={hasMealPlans}
        />
      )}
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
      <div className="relative z-10 p-6 lg:p-8 space-y-8">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </div>
    </div>
  );
}
