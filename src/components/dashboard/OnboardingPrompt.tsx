"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Sparkles, X, ChevronRight, Target, Utensils, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { checkOnboardingStatus } from "@/actions/onboarding";

const DISMISS_KEY = "DietAIbook_onboarding_prompt_dismissed";

export function OnboardingPrompt() {
  const _t = useTranslations("dashboard");
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      // Check if user dismissed the prompt
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed === "true") {
        setIsLoading(false);
        return;
      }

      // Check onboarding status from server
      const status = await checkOnboardingStatus();

      // Show prompt only if onboarding is NOT completed
      if (!status.completed) {
        setIsVisible(true);
      }
      setIsLoading(false);
    }

    checkStatus();
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setIsVisible(false);
  };

  if (isLoading || !isVisible) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden border-brand-200 dark:border-brand-800 bg-gradient-to-br from-brand-50 to-gold-50 dark:from-brand-950/50 dark:to-gold-950/30">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-brand-100 dark:bg-brand-900">
            <Sparkles className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <CardTitle className="text-lg">Complete Your Profile Setup</CardTitle>
            <CardDescription>
              Personalize your meal planning experience
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Take a few minutes to set up your profile and unlock personalized features:
        </p>

        {/* Benefits list */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2 p-3 rounded-lg bg-white/50 dark:bg-black/20">
            <Target className="h-4 w-4 text-brand-600 dark:text-brand-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Custom Macro Targets</p>
              <p className="text-xs text-muted-foreground">Based on your goals</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-white/50 dark:bg-black/20">
            <Utensils className="h-4 w-4 text-brand-600 dark:text-brand-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Dietary Preferences</p>
              <p className="text-xs text-muted-foreground">Filter by allergies</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-white/50 dark:bg-black/20">
            <Users className="h-4 w-4 text-brand-600 dark:text-brand-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Family Profiles</p>
              <p className="text-xs text-muted-foreground">Plan for everyone</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/onboarding">
              Complete Setup
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            Maybe Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
