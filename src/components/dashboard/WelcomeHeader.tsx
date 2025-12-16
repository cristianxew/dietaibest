"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-gradient-to-br from-brand-100 to-brand-50 dark:from-brand-500/20 dark:to-brand-500/10 border border-brand-200/50 dark:border-brand-500/20">
          <LayoutDashboard className="w-5 h-5 text-brand-600 dark:text-brand-400" />
        </div>
        <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
          Dashboard
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
          {greeting}
        </h1>

        {hasActivePlan && (
          <Badge
            variant="outline"
            className="bg-sage-50 dark:bg-sage-950/50 text-sage-700 dark:text-sage-300 border-sage-200 dark:border-sage-800 gap-1.5 py-1 px-3 ml-2"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Plan Active</span>
          </Badge>
        )}

        {isNewUser && (
          <Badge
            variant="outline"
            className="bg-gold-50 dark:bg-gold-950/50 text-gold-700 dark:text-gold-300 border-gold-200 dark:border-gold-800 gap-1.5 py-1 px-3 ml-2"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Getting Started</span>
          </Badge>
        )}
      </div>

      <p className="text-muted-foreground max-w-lg leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}
