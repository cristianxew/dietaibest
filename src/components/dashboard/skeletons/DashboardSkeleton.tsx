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

export function QuickActionsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card
          key={i}
          className="relative overflow-hidden border-stone-200/50 dark:border-stone-800/50"
        >
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-stone-200 dark:bg-stone-800" />
          <CardContent className="p-4 pl-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl bg-stone-200/50 dark:bg-stone-800/50" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24 bg-stone-200/50 dark:bg-stone-800/50" />
                <Skeleton className="h-3 w-32 bg-stone-200/30 dark:bg-stone-800/30" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function MacroProgressSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-40 bg-stone-200/50 dark:bg-stone-800/50" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Ring chart placeholder */}
        <div className="flex justify-center py-4">
          <Skeleton className="h-40 w-40 rounded-full bg-stone-200/30 dark:bg-stone-800/30" />
        </div>
        {/* Macro bars */}
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-20 bg-stone-200/50 dark:bg-stone-800/50" />
                <Skeleton className="h-4 w-16 bg-stone-200/30 dark:bg-stone-800/30" />
              </div>
              <Skeleton className="h-2 w-full rounded-full bg-stone-200/30 dark:bg-stone-800/30" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function StatsSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-28 bg-stone-200/50 dark:bg-stone-800/50" />
      </CardHeader>
      <CardContent className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg bg-stone-200/50 dark:bg-stone-800/50" />
              <Skeleton className="h-4 w-24 bg-stone-200/30 dark:bg-stone-800/30" />
            </div>
            <Skeleton className="h-7 w-10 bg-stone-200/50 dark:bg-stone-800/50" />
          </div>
        ))}
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
        {/* Mini calendar */}
        <div className="flex justify-center gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Skeleton className="h-3 w-6 bg-stone-200/30 dark:bg-stone-800/30" />
              <Skeleton className="h-8 w-8 rounded-full bg-stone-200/50 dark:bg-stone-800/50" />
            </div>
          ))}
        </div>
        {/* Today's meals */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 bg-stone-200/50 dark:bg-stone-800/50" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-6 w-6 rounded bg-stone-200/30 dark:bg-stone-800/30" />
              <Skeleton className="h-4 w-32 bg-stone-200/30 dark:bg-stone-800/30" />
            </div>
          ))}
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

export function RecentRecipesSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-36 bg-stone-200/50 dark:bg-stone-800/50" />
          <Skeleton className="h-4 w-16 bg-stone-200/30 dark:bg-stone-800/30" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-40 space-y-2">
              <Skeleton className="h-24 w-full rounded-xl bg-stone-200/30 dark:bg-stone-800/30" />
              <Skeleton className="h-4 w-32 bg-stone-200/50 dark:bg-stone-800/50" />
              <Skeleton className="h-3 w-20 bg-stone-200/30 dark:bg-stone-800/30" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function CategoryBreakdownSkeleton() {
  return (
    <Card className="border-stone-200/50 dark:border-stone-800/50">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-36 bg-stone-200/50 dark:bg-stone-800/50" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded bg-stone-200/50 dark:bg-stone-800/50" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24 bg-stone-200/30 dark:bg-stone-800/30" />
              <Skeleton className="h-1.5 w-full rounded-full bg-stone-200/20 dark:bg-stone-800/20" />
            </div>
            <Skeleton className="h-4 w-8 bg-stone-200/30 dark:bg-stone-800/30" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <WelcomeHeaderSkeleton />
      <QuickActionsSkeleton />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <MacroProgressSkeleton />
          <ActivePlanSkeleton />
          <WeeklyChartSkeleton />
          <RecentRecipesSkeleton />
        </div>
        <div className="space-y-6">
          <StatsSkeleton />
          <CategoryBreakdownSkeleton />
        </div>
      </div>
    </div>
  );
}
