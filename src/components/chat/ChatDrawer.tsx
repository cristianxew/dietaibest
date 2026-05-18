"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ChatHeader } from "./ChatHeader";
import { ChatComposer } from "./ChatComposer";
import { ChatMessage } from "./ChatMessage";
import { EmptyChat } from "./EmptyChat";
import { SessionList } from "./SessionList";
import { useChatStream, type PendingAttachment } from "./useChatStream";

interface ChatDrawerProps {
  onClose: () => void;
  isMobile: boolean;
  isOpen: boolean;
}

export function ChatDrawer({ onClose, isOpen }: ChatDrawerProps) {
  const locale = useLocale();
  const t = useTranslations("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [composerInitial, setComposerInitial] = useState("");

  const translate = useMemo(
    () => ({
      status: (key: string, params?: Record<string, string | number>) => {
        try {
          return t(
            key.replace(/^chat\./, "") as Parameters<typeof t>[0],
            params
          ) as string;
        } catch {
          return t("status.tool.invoked" as Parameters<typeof t>[0]) as string;
        }
      },
      confirmDelete: (name: string) =>
        t("confirm.delete.recipe" as Parameters<typeof t>[0], { name }) as string,
      error: (reason: "generic" | "quota" | "notFound" | "unauthorized") => {
        switch (reason) {
          case "quota":
            return t("toolError.quotaExceeded" as Parameters<typeof t>[0]) as string;
          case "notFound":
            return t("toolError.notFound" as Parameters<typeof t>[0]) as string;
          case "unauthorized":
            return t("toolError.unauthorized" as Parameters<typeof t>[0]) as string;
          default:
            return t("toolError.generic" as Parameters<typeof t>[0]) as string;
        }
      },
      guardrailRedacted: () =>
        t("guardrail.nutritionRedacted" as Parameters<typeof t>[0]) as string,
      success: () => t("status.success" as Parameters<typeof t>[0]) as string,
      deleted: () => t("confirm.deleted" as Parameters<typeof t>[0]) as string,
      cancelled: () => t("confirm.cancelled" as Parameters<typeof t>[0]) as string,
      costCapReached: (resetsOnIso: string) => {
        const reached = t("costCap.reached" as Parameters<typeof t>[0]) as string;
        try {
          const formatted = new Intl.DateTimeFormat(locale, {
            dateStyle: "long",
          }).format(new Date(resetsOnIso));
          const resetsOn = t("costCap.resetsOn" as Parameters<typeof t>[0], {
            date: formatted,
          }) as string;
          return `${reached} ${resetsOn}`;
        } catch {
          return reached;
        }
      },
    }),
    [t, locale]
  );

  const [sessionsOpen, setSessionsOpen] = useState(false);

  const { messages, isStreaming, send, clear, retry, canRetry, switchSession, createSession } = useChatStream({
    locale,
    translate,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleClear = useCallback(async () => {
    const confirmText = t("confirmClear" as Parameters<typeof t>[0]) as string;
    if (typeof window !== "undefined" && window.confirm(confirmText)) {
      await clear();
    }
  }, [clear, t]);

  const handleSend = useCallback(
    async (text: string, attachment?: PendingAttachment) => {
      const trimmed = text.trim();
      if (!trimmed && !attachment) return;
      await send(trimmed, attachment);
    },
    [send]
  );

  const handleSuggestionClick = useCallback((text: string) => {
    setComposerInitial(text);
  }, []);

  const lastUserMsgIndex = messages.reduce(
    (acc, _m, i) => (messages[i].role === "user" ? i : acc),
    -1
  );

  return (
    <div className="flex flex-col h-full w-full relative">
      <SessionList
        isOpen={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        onSessionSelect={(id) => { switchSession(id); setSessionsOpen(false); }}
        onNewChat={() => { createSession(); setSessionsOpen(false); }}
        locale={locale}
      />

      <ChatHeader
        onClose={onClose}
        onClear={handleClear}
        onToggleSessions={() => setSessionsOpen((p) => !p)}
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 scroll-smooth"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <EmptyChat onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="flex flex-col space-y-2">
            {messages.map((msg, i) => (
              <ChatMessage
                key={msg.id}
                {...msg}
                isLastUserMessage={i === lastUserMsgIndex}
                onRetry={canRetry ? retry : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <ChatComposer
        onSend={handleSend}
        initialValue={composerInitial}
        disabled={isStreaming}
      />
    </div>
  );
}
