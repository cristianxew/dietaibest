"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Clock, Copy, Flame, Globe, Utensils } from "lucide-react";
import { toast } from "sonner";
import { duplicateMealPlan, getPublicMealPlans } from "@/actions/meal-plan";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RecipeThumb } from "./shared";

type PublicPlansData = NonNullable<
  Awaited<ReturnType<typeof getPublicMealPlans>>["data"]
>;
type PublicPlan = PublicPlansData["templates"][number];

const PAGE_SIZE = 24;

const errorMessage = (error: unknown, fallback: string): string =>
  typeof error === "string" ? error : fallback;

interface PublicPlansProps {
  /** Called with the new template id after duplicating a public plan. */
  onDuplicated: (templateId: string) => void;
}

export function PublicPlans({ onDuplicated }: PublicPlansProps) {
  const t = useTranslations("mealPlans");
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPage = useCallback(
    (nextPage: number) => {
      if (nextPage === 1) setIsLoading(true);
      startTransition(async () => {
        try {
          const result = await getPublicMealPlans({
            page: nextPage,
            limit: PAGE_SIZE,
          });
          if (result.error || !result.data) {
            toast.error(errorMessage(result.error, t("noPublicPlans")));
            return;
          }
          const { templates, pagination } = result.data;
          setPlans((prev) =>
            nextPage === 1 ? templates : [...prev, ...templates]
          );
          setPage(pagination.page);
          setTotalPages(pagination.totalPages);
        } finally {
          setIsLoading(false);
        }
      });
    },
    [t]
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const handleDuplicate = (plan: PublicPlan) => {
    setDuplicatingId(plan.id);
    startTransition(async () => {
      try {
        const result = await duplicateMealPlan(plan.id);
        if (result.error || !result.data) {
          toast.error(errorMessage(result.error, t("planDuplicated")));
          return;
        }
        toast.success(t("planDuplicated"));
        onDuplicated(result.data.id);
      } finally {
        setDuplicatingId(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="w-12 h-12 rounded-xl bg-brand-500/[0.14] flex items-center justify-center">
          <Globe className="w-6 h-6 text-brand-500 dark:text-brand-600" />
        </div>
        <p className="text-sm text-muted-foreground max-w-sm">
          {t("noPublicPlans")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="p-4 bg-card border border-border rounded-xl flex flex-col gap-3"
          >
            {/* Title + author */}
            <div>
              <div className="font-display text-base font-semibold tracking-tight text-foreground truncate">
                {plan.name}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {t("byAuthor", { author: plan.user.name })}
              </p>
            </div>

            {/* Overview stats */}
            <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="w-[11px] h-[11px]" />
                {plan.duration}d
              </span>
              <span className="flex items-center gap-1">
                <Utensils className="w-[11px] h-[11px]" />
                {plan.mealSlots.length}
                {t("perDay")}
              </span>
              <span className="flex items-center gap-1 text-brand-500">
                <Flame className="w-[11px] h-[11px]" />
                {plan.targetCalories ?? 0} kcal
              </span>
            </div>

            {/* Macro targets */}
            {(plan.targetProtein != null ||
              plan.targetCarbs != null ||
              plan.targetFat != null) && (
              <div className="flex flex-wrap gap-2 text-[10px] font-medium">
                {plan.targetProtein != null && (
                  <span className="px-1.5 py-0.5 rounded-md bg-sage-500/10 text-sage-600 dark:text-sage-400">
                    {Math.round(plan.targetProtein)}g P
                  </span>
                )}
                {plan.targetCarbs != null && (
                  <span className="px-1.5 py-0.5 rounded-md bg-gold-500/10 text-gold-600 dark:text-gold-400">
                    {Math.round(plan.targetCarbs)}g C
                  </span>
                )}
                {plan.targetFat != null && (
                  <span className="px-1.5 py-0.5 rounded-md bg-stone-500/10 text-stone-600 dark:text-stone-400">
                    {Math.round(plan.targetFat)}g F
                  </span>
                )}
              </div>
            )}

            {/* Recipe preview */}
            {plan.recipes.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t("recipes")}
                </div>
                <div className="flex items-center gap-1.5">
                  {plan.recipes.slice(0, 5).map((recipe) => (
                    <RecipeThumb
                      key={recipe.id}
                      recipe={{ title: recipe.title, imageUrl: recipe.imageUrl }}
                      size={32}
                      radius={8}
                    />
                  ))}
                  {plan.recipeCount > 5 && (
                    <span className="text-[11px] font-medium text-muted-foreground ml-0.5">
                      +{plan.recipeCount - 5}
                    </span>
                  )}
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="mt-auto gap-2 self-start"
              disabled={duplicatingId === plan.id}
              onClick={() => handleDuplicate(plan)}
            >
              <Copy className="w-3.5 h-3.5" />
              {t("duplicate")}
            </Button>
          </div>
        ))}
      </div>

      {page < totalPages && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={isPending}
            onClick={() => loadPage(page + 1)}
          >
            {t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
