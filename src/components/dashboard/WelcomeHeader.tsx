"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Trophy } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";

interface WelcomeHeaderProps {
  hasRecipes: boolean;
  hasMealPlans: boolean;
  /** Subscription plan (`isPro` in `src/lib/plan.ts`), not plan activity. */
  isPro: boolean;
}

export function WelcomeHeader({
  hasRecipes,
  hasMealPlans,
  isPro,
}: WelcomeHeaderProps) {
  const t = useTranslations("dashboard");
  const { user } = useAuth();
  const [greeting, setGreeting] = useState<string>("");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting(t("greeting.morning"));
    } else if (hour >= 12 && hour < 18) {
      setGreeting(t("greeting.afternoon"));
    } else {
      setGreeting(t("greeting.evening"));
    }
  }, [t]);

  const isNewUser = !hasRecipes && !hasMealPlans;
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <h1 className="text-3xl lg:text-[2rem] font-display font-bold text-foreground tracking-tight">
        {greeting}{firstName ? `, ${firstName}` : ""}
      </h1>

      {isPro && (
        <Badge
          variant="outline"
          className="bg-gradient-to-r from-amber-200 to-amber-400 dark:from-amber-500/20 dark:to-amber-600/30 text-amber-900 dark:text-amber-200 border-amber-300/50 dark:border-amber-500/30 gap-1.5 py-1 px-3"
        >
          <Trophy className="h-3.5 w-3.5" />
          <span className="text-xs uppercase tracking-wider font-bold">{t("proBadge")}</span>
        </Badge>
      )}

      {isNewUser && (
        <Badge
          variant="outline"
          className="bg-gold-50 dark:bg-gold-900/40 text-gold-700 dark:text-gold-300 border-gold-200 dark:border-gold-700 gap-1.5 py-1 px-3"
        >
          <Trophy className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">{t("dayOne")}</span>
        </Badge>
      )}
    </div>
  );
}
