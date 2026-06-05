"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { FileText, Link as LinkIcon, Image as ImageIcon, Calendar } from "lucide-react";
import { LogoSymbol } from "./LogoSymbol";

interface EmptyChatProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  const t = useTranslations("chat");
  const te = useTranslations("chat.empty");

  const suggestions = [
    { Icon: FileText, text: te("suggestion1"), prompt: te("suggestion1Prompt") },
    { Icon: LinkIcon, text: te("suggestion2"), prompt: te("suggestion2Prompt") },
    { Icon: ImageIcon, text: te("suggestion3"), prompt: te("suggestion3Prompt") },
    { Icon: Calendar, text: te("suggestion4"), prompt: te("suggestion4Prompt") },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
        <LogoSymbol size={40} tone="auto" />
      </div>

      <h2 className="mb-2 font-display text-2xl font-semibold text-foreground">
        {t("assistant")}
      </h2>
      <p className="mb-8 max-w-[32ch] text-sm leading-relaxed text-muted-foreground">
        {te("subtitle")}
      </p>

      <div className="flex w-full max-w-[360px] flex-col gap-2">
        {suggestions.map(({ Icon, text, prompt }, i) => (
          <button
            key={i}
            onClick={() => onSuggestionClick(prompt)}
            className="flex items-center gap-3 rounded-md border-[1.5px] border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-1 hover:border-primary hover:bg-muted"
          >
            <Icon size={18} className="shrink-0 text-primary" />
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
