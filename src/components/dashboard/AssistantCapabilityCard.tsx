"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AskDietAIButton } from "@/components/chat/AskDietAIButton";
import { selectCapabilitiesForPath } from "@/lib/chat/capabilities";

/**
 * Dashboard discovery card: a daily-rotating sample of what the chat
 * assistant can do. Rotation is keyed to the UTC day-of-year so SSR and
 * hydration agree and the selection is testable with a fixed clock.
 */
export function AssistantCapabilityCard() {
  const t = useTranslations("chat.entry.dashboard");
  const tc = useTranslations("chat.capabilities");
  const locale = useLocale();

  const pool = selectCapabilitiesForPath(`/${locale}/dashboard`, locale, 6);
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000
  );
  const shown = Array.from(
    { length: Math.min(3, pool.length) },
    (_, i) => pool[(dayOfYear + i) % pool.length]
  );

  if (shown.length === 0) return null;

  return (
    <Card className="border-stone-200/70 dark:border-stone-800/70 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-display font-semibold tracking-tight">
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="mb-3 text-sm text-muted-foreground">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-2">
          {shown.map((cap) => (
            <AskDietAIButton key={cap.id} prompt={tc(`${cap.id}.prompt`)}>
              {tc(`${cap.id}.label`)}
            </AskDietAIButton>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
