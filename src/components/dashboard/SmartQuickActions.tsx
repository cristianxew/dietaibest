"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  ChefHat,
  Link2,
  CalendarPlus,
  UtensilsCrossed,
  CalendarCheck,
  ShoppingCart,
  Plus,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SmartQuickActionsProps {
  hasRecipes: boolean;
  hasMealPlans: boolean;
  hasActivePlan: boolean;
}

interface QuickAction {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
  color: "brand" | "sage" | "gold" | "slate";
}

export function SmartQuickActions({
  hasRecipes,
  hasMealPlans,
  hasActivePlan,
}: SmartQuickActionsProps) {
  const t = useTranslations("dashboard.smartActions");

  // Determine which actions to show based on user state
  const getActions = (): QuickAction[] => {
    // New user - no recipes
    if (!hasRecipes) {
      return [
        {
          href: "/recipes/new",
          icon: <ChefHat className="h-4 w-4" />,
          label: t("addFirstRecipe"),
          primary: true,
          color: "brand",
        },
        {
          href: "/recipes/new?mode=url",
          icon: <Link2 className="h-4 w-4" />,
          label: t("importFromUrl"),
          color: "gold",
        },
        {
          href: "/meal-plans",
          icon: <LayoutGrid className="h-4 w-4" />,
          label: t("browseTemplates"),
          color: "slate",
        },
      ];
    }

    // Has recipes, no meal plans
    if (!hasMealPlans) {
      return [
        {
          href: "/meal-plans/new",
          icon: <CalendarPlus className="h-4 w-4" />,
          label: t("createMealPlan"),
          primary: true,
          color: "brand",
        },
        {
          href: "/recipes",
          icon: <UtensilsCrossed className="h-4 w-4" />,
          label: t("browseRecipes"),
          color: "sage",
        },
        {
          href: "/recipes/new?mode=url",
          icon: <Link2 className="h-4 w-4" />,
          label: t("importFromUrl"),
          color: "gold",
        },
      ];
    }

    // Has recipes and meal plans, but no active schedule
    if (!hasActivePlan) {
      return [
        {
          href: "/meal-plans",
          icon: <CalendarCheck className="h-4 w-4" />,
          label: t("schedulePlan"),
          primary: true,
          color: "brand",
        },
        {
          href: "/recipes",
          icon: <UtensilsCrossed className="h-4 w-4" />,
          label: t("browseRecipes"),
          color: "sage",
        },
        {
          href: "/recipes/new",
          icon: <Plus className="h-4 w-4" />,
          label: t("addRecipe"),
          color: "gold",
        },
      ];
    }

    // Full user - has everything
    return [
      {
        href: "/meal-plans",
        icon: <CalendarCheck className="h-4 w-4" />,
        label: t("todaysPlan"),
        primary: true,
        color: "brand",
      },
      {
        href: "/recipes/new",
        icon: <Plus className="h-4 w-4" />,
        label: t("addRecipe"),
        color: "sage",
      },
      {
        href: "/shopping",
        icon: <ShoppingCart className="h-4 w-4" />,
        label: t("shoppingList"),
        color: "gold",
      },
      {
        href: "/meal-plans",
        icon: <LayoutGrid className="h-4 w-4" />,
        label: t("viewAllPlans"),
        color: "slate",
      },
    ];
  };

  const actions = getActions();

  const getColorClasses = (color: QuickAction["color"], primary?: boolean) => {
    const colors = {
      brand: {
        bg: primary
          ? "bg-brand-500 text-white hover:bg-brand-600"
          : "bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50",
        ring: primary ? "ring-brand-500/20" : "",
      },
      sage: {
        bg: "bg-sage-50 dark:bg-sage-950/50 text-sage-600 dark:text-sage-400 hover:bg-sage-100 dark:hover:bg-sage-900/50",
        ring: "",
      },
      gold: {
        bg: "bg-gold-50 dark:bg-gold-950/50 text-gold-600 dark:text-gold-400 hover:bg-gold-100 dark:hover:bg-gold-900/50",
        ring: "",
      },
      slate: {
        bg: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700",
        ring: "",
      },
    };
    return colors[color];
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => {
        const colors = getColorClasses(action.color, action.primary);

        return (
          <Link
            key={action.href + index}
            href={action.href}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
              colors.bg,
              action.primary && "ring-2 ring-offset-2 ring-offset-background",
              colors.ring
            )}
          >
            {action.icon}
            <span className="whitespace-nowrap">{action.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
