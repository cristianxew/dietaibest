"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Trophy, Calendar, LayoutDashboard } from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";

interface WelcomeHeaderProps {
  hasRecipes: boolean;
  hasMealPlans: boolean;
  hasActivePlan: boolean;
  profileComplete: boolean;
}

export function WelcomeHeader({
  hasRecipes,
  hasMealPlans,
  hasActivePlan,
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
  const subtitle = isNewUser ? t("subtitle.new") : t("subtitle.returning");
  const firstName = user?.name?.split(" ")[0];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
          <LayoutDashboard className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        </div>
        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
          {t("dashboardLabel")}
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-4xl lg:text-5xl font-display font-bold text-foreground tracking-tight">
          {greeting}{firstName ? `, ${firstName}` : ""}
        </h1>

        {hasActivePlan && (
          <Badge
            variant="outline"
            className="bg-gradient-to-r from-amber-200 to-amber-400 dark:from-amber-500/20 dark:to-amber-600/30 text-amber-900 dark:text-amber-200 border-amber-300/50 dark:border-amber-500/30 gap-1.5 py-1 px-3 ml-2"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider font-bold">PRO</span>
          </Badge>
        )}

        {isNewUser && (
          <Badge
            variant="outline"
            className="bg-gold-50 dark:bg-gold-900/40 text-gold-700 dark:text-gold-300 border-gold-200 dark:border-gold-700 gap-1.5 py-1 px-3 ml-2"
          >
            <Trophy className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">{t("dayOne")}</span>
          </Badge>
        )}
      </div>

      <p className="text-muted-foreground max-w-lg leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}
