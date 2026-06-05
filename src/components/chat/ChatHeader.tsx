"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { X, SquarePen, History } from "lucide-react";
import { LogoSymbol } from "./LogoSymbol";

interface ChatHeaderProps {
  onClose: () => void;
  onToggleSessions: () => void;
  onNewChat: () => void;
}

export function ChatHeader({ onClose, onToggleSessions, onNewChat }: ChatHeaderProps) {
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
          className="flex items-center p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("sessions.title")}
          title={t("sessions.title")}
        >
          <History size={18} />
        </button>
        <button
          onClick={onNewChat}
          className="flex items-center p-1 text-muted-foreground transition-colors hover:text-foreground"
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
