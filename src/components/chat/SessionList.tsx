"use client";

import React, { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { SessionItem } from "./SessionItem";

interface Session {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  isActive: boolean;
}

interface SessionListProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect: (id: string) => void;
  onNewChat: () => void;
  locale: string;
}

export function SessionList({
  isOpen,
  onClose,
  onSessionSelect,
  onNewChat,
  locale,
}: SessionListProps) {
  const t = useTranslations("chat");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {/* Backdrop — sibling to panel, covers rest of drawer when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-9"
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "absolute inset-y-0 left-0 w-[280px] bg-card border-r border-border",
          "flex flex-col z-10",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card relative z-10">
          <h3 className="text-sm font-semibold text-foreground">
            {t("sessions.title")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors"
            aria-label={t("sessions.title")}
          >
            <X size={16} />
          </button>
        </div>

        {/* New chat button */}
        <button
          onClick={onNewChat}
          className={cn(
            "flex items-center gap-2 mx-3 my-2 px-3 py-2 text-sm rounded-lg",
            "border border-dashed border-border",
            "hover:bg-stone-50 dark:hover:bg-stone-900",
            "text-muted-foreground hover:text-foreground transition-colors"
          )}
        >
          <Plus size={14} />
          {t("sessions.newChat")}
        </button>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto relative z-10">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <span className="text-xs text-muted-foreground">…</span>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {t("sessions.empty")}
            </p>
          ) : (
            sessions.map((s) => (
              <SessionItem
                key={s.id}
                {...s}
                locale={locale}
                onActivate={onSessionSelect}
                onDelete={handleDelete}
                isDeleting={deletingId === s.id}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
