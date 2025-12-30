"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function WelcomeHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-64 bg-stone-200/50 dark:bg-stone-800/50" />
      <Skeleton className="h-5 w-96 bg-stone-200/30 dark:bg-stone-800/30" />
    </div>
  );
}

export function CompactStatsSkeleton() {
  return (
    <div className="hidden lg:block">
      <div className="flex gap-4 p-2 rounded-2xl border border-stone-200/50 dark:border-stone-800/50">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="px-4 py-2 w-28 border-r border-stone-200/50 dark:border-stone-800/50 last:border-0">
            <Skeleton className="h-3 w-16 mb-2 bg-stone-200/30 dark:bg-stone-800/30" />
            <Skeleton className="h-8 w-12 bg-stone-200/50 dark:bg-stone-800/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompactNutritionSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-40 bg-stone-200/50 dark:bg-stone-800/50" />
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-row items-center gap-6 sm:gap-8 py-6">
          {/* Donut Chart Placeholder */}
          <Skeleton className="h-[90px] w-[90px] rounded-full shrink-0 bg-stone-200/30 dark:bg-stone-800/30" />

          {/* Stats Columns */}
          <div className="flex items-center gap-4 sm:gap-6 md:gap-8 flex-wrap">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 min-w-[50px]">
                <Skeleton className="h-6 w-12 bg-stone-200/50 dark:bg-stone-800/50" />
                <Skeleton className="h-3 w-8 bg-stone-200/30 dark:bg-stone-800/30" />
                <Skeleton className="h-3 w-8 rounded-full bg-stone-200/20 dark:bg-stone-800/20" />
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
    <Card className="border-stone-200/50 dark:border-stone-800/50 flex-1">
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
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36 bg-stone-200/50 dark:bg-stone-800/50" />
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
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-md bg-stone-200/30 dark:bg-stone-800/30" />
            <Skeleton className="h-8 w-20 rounded-md bg-stone-200/30 dark:bg-stone-800/30" />
          </div>
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

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-end">
        <div className="flex-1 min-w-0">
          <WelcomeHeaderSkeleton />
        </div>
        <CompactStatsSkeleton />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column */}
        <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-6 h-full">
          <CompactNutritionSkeleton />
          <WeeklyChartSkeleton />
        </div>

        {/* Right Column */}
        <div className="lg:col-span-6 xl:col-span-7 space-y-6">
          <ActivePlanSkeleton />
          <RecentRecipesSkeleton />
        </div>
      </div>
    </div>
  );
}
