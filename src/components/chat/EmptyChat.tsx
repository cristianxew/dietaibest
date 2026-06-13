"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { LogoSymbol } from "./LogoSymbol";
import { selectCapabilitiesForPath } from "@/lib/chat/capabilities";
import { resolvePageArea } from "@/lib/chat/page-context";

interface EmptyChatProps {
  onSuggestionClick: (text: string) => void;
}

export function EmptyChat({ onSuggestionClick }: EmptyChatProps) {
  const t = useTranslations("chat");
  const te = useTranslations("chat.empty");
  const tc = useTranslations("chat.capabilities");
  const pathname = usePathname();
  const locale = useLocale();

  const { entity } = resolvePageArea(pathname, locale);
  const suggestions = selectCapabilitiesForPath(pathname, locale, 5);

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
        {suggestions.map((cap) => {
          const Icon = cap.icon;
          const prompt =
            cap.entityAware && entity
              ? tc(`${cap.id}.entityPrompt`)
              : tc(`${cap.id}.prompt`);
          return (
            <button
              key={cap.id}
              onClick={() => onSuggestionClick(prompt)}
              className="flex items-center gap-3 rounded-md border-[1.5px] border-border bg-card px-4 py-3 text-left text-sm font-medium text-foreground hover:border-primary hover:bg-muted"
            >
              <Icon size={18} className="shrink-0 text-primary" />
              {tc(`${cap.id}.label`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
