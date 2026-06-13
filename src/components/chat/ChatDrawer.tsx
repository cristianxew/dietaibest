"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ChatHeader } from "./ChatHeader";
import { ChatComposer } from "./ChatComposer";
import { ChatMessage } from "./ChatMessage";
import { EmptyChat } from "./EmptyChat";
import { HistoryPanel } from "./HistoryPanel";
import { CapabilityMenu } from "./CapabilityMenu";
import { SuggestionChips } from "./SuggestionChips";
import { useChatStream, type PendingAttachment } from "./useChatStream";

interface ChatDrawerProps {
  onClose: () => void;
  isMobile: boolean;
  isOpen: boolean;
  seedPrompt?: string;
  onSeedConsumed?: () => void;
}

export function ChatDrawer({ onClose, isOpen, seedPrompt, onSeedConsumed }: ChatDrawerProps) {
  const locale = useLocale();
  const t = useTranslations("chat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [composerInitial, setComposerInitial] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      confirmGenerateImage: (name: string) =>
        t("confirm.generateImage.recipe" as Parameters<typeof t>[0], { name }) as string,
      generateImageYes: () => t("confirm.generateImage.yes" as Parameters<typeof t>[0]) as string,
      generateImageNo: () => t("confirm.generateImage.no" as Parameters<typeof t>[0]) as string,
      generateImageSkipped: () => t("confirm.generateImage.skipped" as Parameters<typeof t>[0]) as string,
      error: (
        reason: "generic" | "quota" | "notFound" | "unauthorized" | "rateLimited"
      ) => {
        switch (reason) {
          case "quota":
            return t("toolError.quotaExceeded" as Parameters<typeof t>[0]) as string;
          case "notFound":
            return t("toolError.notFound" as Parameters<typeof t>[0]) as string;
          case "unauthorized":
            return t("toolError.unauthorized" as Parameters<typeof t>[0]) as string;
          case "rateLimited":
            return t("toolError.rateLimited" as Parameters<typeof t>[0]) as string;
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

  const {
    messages,
    isStreaming,
    send,
    retry,
    canRetry,
    deleteLastTurn,
    switchSession,
    createSession,
    followUps,
  } = useChatStream({ locale, translate });

  // When parent passes a seed prompt (e.g. from the meal-planner AI button),
  // populate the composer and clear the seed so it only fires once.
  useEffect(() => {
    if (seedPrompt && isOpen) {
      setComposerInitial(seedPrompt);
      onSeedConsumed?.();
    }
  }, [seedPrompt, isOpen, onSeedConsumed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const flashToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1500);
  }, []);

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

  const handleNewChat = useCallback(() => {
    createSession();
    setSessionsOpen(false);
  }, [createSession]);

  const handleEditLastTurn = useCallback(async () => {
    const text = await deleteLastTurn();
    if (text != null) setComposerInitial(text);
  }, [deleteLastTurn]);

  const handleDeleteLastTurn = useCallback(async () => {
    await deleteLastTurn();
  }, [deleteLastTurn]);

  const lastUserMsgIndex = messages.reduce(
    (acc, _m, i) => (messages[i].role === "user" ? i : acc),
    -1
  );
  const lastIndex = messages.length - 1;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      <ChatHeader
        onClose={onClose}
        onToggleSessions={() => setSessionsOpen((p) => !p)}
        onToggleCapabilities={() => setCapabilitiesOpen((p) => !p)}
        onNewChat={handleNewChat}
        busy={isStreaming}
      />

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden p-4 scroll-smooth"
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <EmptyChat onSuggestionClick={handleSuggestionClick} />
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage
                key={msg.id}
                {...msg}
                streaming={
                  isStreaming &&
                  i === lastIndex &&
                  msg.role === "agent" &&
                  !!msg.content.text
                }
                isLastUserMessage={i === lastUserMsgIndex}
                canModify={i === lastUserMsgIndex && canRetry && !msg.failed}
                onRetry={canRetry ? retry : undefined}
                onCopied={() => flashToast(t("copied"))}
                onEdit={handleEditLastTurn}
                onDelete={handleDeleteLastTurn}
              />
            ))}
            {!isStreaming && followUps.length > 0 && (
              <SuggestionChips
                capabilities={followUps}
                onPick={handleSuggestionClick}
              />
            )}
          </>
        )}
      </div>

      <ChatComposer
        onSend={handleSend}
        initialValue={composerInitial}
        disabled={isStreaming}
      />

      <HistoryPanel
        visible={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        onSelect={(id) => {
          switchSession(id);
          setSessionsOpen(false);
        }}
        onNewChat={handleNewChat}
        locale={locale}
      />

      <CapabilityMenu
        visible={capabilitiesOpen}
        onClose={() => setCapabilitiesOpen(false)}
        onSelect={(prompt) => {
          setComposerInitial(prompt);
          setCapabilitiesOpen(false);
        }}
      />

      {toast && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
