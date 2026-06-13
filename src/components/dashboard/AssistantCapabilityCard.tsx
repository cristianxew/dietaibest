"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, ArrowUpRight, Search } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { openChatWithPrompt } from "@/components/chat/openChat";
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
    <Card className="relative overflow-hidden border border-ai-200/60 dark:border-ai-800/40 bg-gradient-to-br from-card via-card to-ai-50/20 dark:to-ai-950/10 shadow-md shadow-stone-900/5 transition-all duration-300 hover:shadow-lg hover:shadow-ai/5">
      {/* Background soft glow blobs */}
      <div className="absolute -right-6 -top-6 h-48 w-48 rounded-full bg-ai-100/30 dark:bg-ai-900/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-6 -bottom-6 h-32 w-32 rounded-full bg-ai-50/40 dark:bg-ai-950/20 blur-2xl pointer-events-none" />

      <CardContent className="p-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Left Side: Welcome & Title */}
          <div className="flex-1 space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-ai bg-ai-50/80 dark:bg-ai-950/50 px-3 py-1.5 rounded-full border border-ai-100 dark:border-ai-800/40 shadow-sm">
              <Sparkles size={12} className="animate-pulse" />
              DietAI Assistant
            </span>
            <div>
              <h2 className="text-2xl font-display font-semibold tracking-tight text-foreground">
                {t("title")}
              </h2>
              <p className="text-muted-foreground mt-1 max-w-md">
                {t("subtitle")}
              </p>
            </div>
          </div>

          {/* Right Side: Interactive Input & Links */}
          <div className="flex-1 w-full flex flex-col items-start lg:items-end gap-4">
            {/* Faux Input */}
            <button
              onClick={() => openChatWithPrompt("")}
              className="w-full lg:max-w-md flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white/60 dark:bg-stone-950/60 backdrop-blur-sm shadow-sm hover:border-ai-300 dark:hover:border-ai-700 hover:ring-4 hover:ring-ai/10 transition-all text-left group outline-none"
            >
              <span className="text-muted-foreground flex items-center gap-2">
                <Search size={16} className="text-stone-400 group-hover:text-ai transition-colors" />
                Ask DietAI anything...
              </span>
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-ai text-white shadow-sm group-hover:scale-110 transition-transform">
                <ArrowUpRight size={14} />
              </span>
            </button>

            {/* Elegant Links */}
            <div className="flex flex-wrap lg:justify-end gap-x-5 gap-y-2 text-sm">
              {shown.map((cap) => (
                <button
                  key={cap.id}
                  onClick={() => openChatWithPrompt(tc(`${cap.id}.prompt`))}
                  className="group flex items-center gap-1.5 text-muted-foreground hover:text-ai transition-colors font-medium outline-none cursor-pointer"
                >
                  {tc(`${cap.id}.label`)}
                  <ArrowUpRight size={14} className="opacity-0 -translate-x-1 translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all text-ai" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
