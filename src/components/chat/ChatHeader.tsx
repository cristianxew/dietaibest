"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { X, Trash2 } from "lucide-react";

interface ChatHeaderProps {
  onClose: () => void;
  onClear: () => void;
}

export function ChatHeader({ onClose, onClear }: ChatHeaderProps) {
  const t = useTranslations("chat");
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <div className="flex flex-col">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <span className="text-xs text-sage-600 dark:text-sage-400 font-medium flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sage-500 animate-pulse" />
          {t("online")}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onClear}
          className="p-2 text-muted-foreground hover:text-destructive hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
          aria-label={t("clearConversation")}
          title={t("clearConversation")}
        >
          <Trash2 size={18} />
        </button>
        <button
          onClick={onClose}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors md:hidden"
          aria-label={t("close")}
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
