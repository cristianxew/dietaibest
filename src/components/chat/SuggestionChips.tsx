"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import type { Capability } from "@/lib/chat/capabilities";
import { resolvePageArea } from "@/lib/chat/page-context";

interface SuggestionChipsProps {
  capabilities: ReadonlyArray<Capability>;
  onPick: (prompt: string) => void;
}

/**
 * Follow-up chips shown under the last agent message after a turn completes
 * (e.g. recipe created → analyze nutrition / generate image / add to plan).
 * Clicking a chip pre-fills the composer — it never auto-sends.
 */
export function SuggestionChips({ capabilities, onPick }: SuggestionChipsProps) {
  const tc = useTranslations("chat.capabilities");
  const tf = useTranslations("chat.followUps");
  const pathname = usePathname();
  const locale = useLocale();

  if (capabilities.length === 0) return null;

  const { entity } = resolvePageArea(pathname, locale);

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 px-1 pb-2">
      <span className="text-xs text-muted-foreground">{tf("title")}</span>
      {capabilities.map((cap) => {
        const Icon = cap.icon;
        const prompt =
          cap.entityAware && entity
            ? tc(`${cap.id}.entityPrompt`)
            : tc(`${cap.id}.prompt`);
        return (
          <button
            key={cap.id}
            onClick={() => onPick(prompt)}
            className="flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-muted"
          >
            <Icon size={14} className="shrink-0 text-primary" />
            {tc(`${cap.id}.label`)}
          </button>
        );
      })}
    </div>
  );
}
