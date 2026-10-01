"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function WelcomeHeaderSkeleton() {
  // Greeting line only (text-3xl / lg:text-[2rem]).
  return <Skeleton className="h-9 w-64 bg-stone-200/50 dark:bg-stone-800/50" />;
}

export function CompactNutritionSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-40 bg-stone-200/50 dark:bg-stone-800/50" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-row items-center gap-5 sm:gap-6 py-4">
          {/* Donut + "% of target" line */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <Skeleton className="h-[90px] w-[90px] rounded-full bg-stone-200/30 dark:bg-stone-800/30" />
            <Skeleton className="h-3 w-20 bg-stone-200/30 dark:bg-stone-800/30" />
          </div>

          {/* Macro rows */}
          <div className="flex-1 min-w-0 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-3 w-12 bg-stone-200/30 dark:bg-stone-800/30" />
                  <Skeleton className="h-4 w-16 bg-stone-200/50 dark:bg-stone-800/50" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full bg-stone-200/20 dark:bg-stone-800/20" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function WeeklyChartSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-40 bg-stone-200/50 dark:bg-stone-800/50" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full rounded-lg bg-stone-200/20 dark:bg-stone-800/20" />
      </CardContent>
    </Card>
  );
}

export function ActivePlanSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 bg-stone-200/30 dark:bg-stone-800/30" />
            <Skeleton className="h-6 w-36 bg-stone-200/50 dark:bg-stone-800/50" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full bg-stone-200/30 dark:bg-stone-800/30" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Row */}
        <div className="flex justify-between gap-1 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-3 w-6 bg-stone-200/30 dark:bg-stone-800/30" />
              <Skeleton className="h-8 w-8 rounded-full bg-stone-200/50 dark:bg-stone-800/50" />
            </div>
          ))}
        </div>
        {/* Meals */}
        <div className="space-y-3 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-lg border border-stone-100 dark:border-stone-900">
              <Skeleton className="h-10 w-10 rounded-md bg-stone-200/30 dark:bg-stone-800/30" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-3/4 bg-stone-200/50 dark:bg-stone-800/50" />
                <Skeleton className="h-3 w-1/2 bg-stone-200/30 dark:bg-stone-800/30" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function RecentRecipesSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36 bg-stone-200/50 dark:bg-stone-800/50" />
          <Skeleton className="h-8 w-20 rounded-md bg-stone-200/30 dark:bg-stone-800/30" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 overflow-hidden pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-40 space-y-2">
              <Skeleton className="h-32 w-full rounded-xl bg-stone-200/30 dark:bg-stone-800/30" />
              <Skeleton className="h-4 w-32 bg-stone-200/50 dark:bg-stone-800/50" />
              <Skeleton className="h-3 w-16 bg-stone-200/30 dark:bg-stone-800/30" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">

      <WelcomeHeaderSkeleton />

      {/* Main Grid: mirrors InteractiveDashboardGrid (plan, nutrition,
          weekly, recipes on phones; plan beside nutrition from lg) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-start gap-6">
        <div className="lg:col-span-7">
          <ActivePlanSkeleton />
        </div>

        <div className="flex flex-col gap-6 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <CompactNutritionSkeleton />
          <WeeklyChartSkeleton />
        </div>

        <div className="lg:col-span-7 lg:col-start-1">
          <RecentRecipesSkeleton />
        </div>
      </div>
    </div>
  );
}
