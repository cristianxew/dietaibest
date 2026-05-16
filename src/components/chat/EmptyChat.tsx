"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ChefHat, Link as LinkIcon, Camera, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyChatProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  const t = useTranslations("chat.empty");

  const suggestions = [
    {
      icon: <ChefHat size={18} className="text-brand-500" />,
      text: t("suggestion1"),
      prompt: t("suggestion1Prompt"),
    },
    {
      icon: <LinkIcon size={18} className="text-brand-500" />,
      text: t("suggestion2"),
      prompt: t("suggestion2Prompt"),
    },
    {
      icon: <Camera size={18} className="text-brand-500" />,
      text: t("suggestion3"),
      prompt: t("suggestion3Prompt"),
    },
    {
      icon: <CalendarDays size={18} className="text-brand-500" />,
      text: t("suggestion4"),
      prompt: t("suggestion4Prompt"),
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center border border-brand-100 dark:border-brand-500/20 mb-2">
        <ChefHat size={32} className="text-brand-500" />
      </div>

      <div className="space-y-2">
        <h3 className="font-display text-2xl font-semibold text-foreground">
          {t("title")}
        </h3>
        <p className="text-muted-foreground text-sm max-w-[240px] mx-auto">
          {t("subtitle")}
        </p>
      </div>

      <div className="w-full space-y-2 mt-4">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(suggestion.prompt)}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-xl text-left",
              "bg-card border border-border",
              "hover:border-brand-200 dark:hover:border-brand-500/30 hover:bg-stone-50 dark:hover:bg-stone-800/50",
              "transition-all duration-200 group"
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center group-hover:scale-105 transition-transform">
              {suggestion.icon}
            </div>
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-foreground">
              {suggestion.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
