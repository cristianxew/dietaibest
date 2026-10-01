"use client";

import React, { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Sparkles, ArrowUpRight, X } from "lucide-react";

import { openChatWithPrompt } from "@/components/chat/openChat";
import { selectCapabilitiesForPath } from "@/lib/chat/capabilities";

const DISMISS_KEY = "dietai:assistant-popup-dismissed";

/**
 * Dashboard discovery popup: a daily-rotating sample of what the chat
 * assistant can do. Rotation is keyed to the UTC day-of-year so SSR and
 * hydration agree and the selection is testable with a fixed clock.
 * Dismissal is remembered per browser.
 */
export function AssistantCapabilityCard() {
  const t = useTranslations("chat.entry.dashboard");
  const tc = useTranslations("chat.capabilities");
  const locale = useLocale();
  // Hidden until mounted so SSR/hydration agree and a dismissed popup never flashes.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  const pool = selectCapabilitiesForPath(`/${locale}/dashboard`, locale, 6);
  const now = new Date();
  const dayOfYear = Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86_400_000
  );
  const shown = Array.from(
    { length: Math.min(3, pool.length) },
    (_, i) => pool[(dayOfYear + i) % pool.length]
  );

  if (!visible || shown.length === 0) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable: dismissal lasts for this page view only.
    }
  };

  return (
    <div
      role="complementary"
      aria-label={t("regionLabel")}
      className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-ai-200/60 dark:border-ai-800/40 bg-card p-4 shadow-xl shadow-stone-900/10"
    >
      {/* 26px visually; the ::after hit slop makes it 44px on touch. */}
      <button
        onClick={dismiss}
        aria-label={t("dismiss")}
        className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors pointer-coarse:after:absolute pointer-coarse:after:-inset-[9px] pointer-coarse:after:content-['']"
      >
        <X size={14} />
      </button>

      <div className="flex items-center gap-2 pr-8 text-ai">
        <Sparkles size={14} />
        <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-3 flex flex-col items-start gap-1.5 text-sm">
        {shown.map((cap) => (
          <button
            key={cap.id}
            onClick={() => openChatWithPrompt(tc(`${cap.id}.prompt`))}
            className="group flex items-center gap-1.5 font-medium text-muted-foreground hover:text-ai transition-colors cursor-pointer"
          >
            {tc(`${cap.id}.label`)}
            <ArrowUpRight
              size={14}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
