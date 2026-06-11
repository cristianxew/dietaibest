"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { X, SquarePen, History } from "lucide-react";
import { LogoSymbol } from "./LogoSymbol";

interface ChatHeaderProps {
  onClose: () => void;
  onToggleSessions: () => void;
  onNewChat: () => void;
  /** Disables session actions while a turn is streaming — switching or
   *  archiving the active conversation mid-run strands the in-flight turn. */
  busy?: boolean;
}

export function ChatHeader({ onClose, onToggleSessions, onNewChat, busy = false }: ChatHeaderProps) {
  const t = useTranslations("chat");

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
          <LogoSymbol size={22} tone="auto" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t("assistant")}
        </h3>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSessions}
          disabled={busy}
          className="flex items-center p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground"
          aria-label={t("sessions.title")}
          title={t("sessions.title")}
        >
          <History size={18} />
        </button>
        <button
          onClick={onNewChat}
          disabled={busy}
          className="flex items-center p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted-foreground"
          aria-label={t("newChat")}
          title={t("newChat")}
        >
          <SquarePen size={18} />
        </button>
        <button
          onClick={onClose}
          className="flex items-center p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("close")}
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
