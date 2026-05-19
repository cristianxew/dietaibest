"use client";

import React, { useCallback, useEffect, useState } from "react";
import { History, MessageCircle, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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

type GroupKey = "today" | "yesterday" | "lastWeek" | "older";

function getGroupKey(date: Date): GroupKey {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOf7DaysAgo = new Date(startOfToday.getTime() - 6 * 86_400_000);
  if (date >= startOfToday) return "today";
  if (date >= startOfYesterday) return "yesterday";
  if (date >= startOf7DaysAgo) return "lastWeek";
  return "older";
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

  const fetchSessions = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (isOpen) fetchSessions();
  }, [isOpen, fetchSessions]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    onNewChat();
    onClose();
  }, [onNewChat, onClose]);

  const groupLabels: Record<GroupKey, string> = {
    today: t("sessions.today"),
    yesterday: t("sessions.yesterday"),
    lastWeek: t("sessions.lastWeek"),
    older: t("sessions.older"),
  };

  const groups = (["today", "yesterday", "lastWeek", "older"] as GroupKey[]).reduce<
    { key: GroupKey; label: string; sessions: Session[] }[]
  >((acc, key) => {
    const grouped = sessions.filter(
      (s) => getGroupKey(new Date(s.updatedAt)) === key,
    );
    if (grouped.length > 0) acc.push({ key, label: groupLabels[key], sessions: grouped });
    return acc;
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={cn(
          "sm:max-w-[420px] p-0 overflow-hidden gap-0",
          "border-border/60 bg-card shadow-2xl rounded-2xl",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4 pr-14">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-500/15 shrink-0">
            <History size={15} className="text-brand-600 dark:text-brand-400" />
          </div>
          <h2 className="font-display font-semibold text-base text-foreground leading-tight">
            {t("sessions.title")}
          </h2>
        </div>

        {/* New conversation button */}
        <div className="px-4 pb-4">
          <button
            onClick={handleNewChat}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl",
              "text-sm font-medium transition-all duration-150",
              "bg-brand-500 hover:bg-brand-600 active:scale-[0.98] text-white",
              "shadow-sm shadow-brand-500/25",
            )}
          >
            <Plus size={15} strokeWidth={2.5} />
            {t("sessions.newChat")}
          </button>
        </div>

        {/* Separator */}
        <div className="h-px bg-border/40 mx-4" />

        {/* Session list */}
        <ScrollArea className="h-[380px]">
          <div className="py-3">
            {isLoading ? (
              /* Skeleton loading */
              <div className="flex flex-col gap-1 px-3">
                {[80, 90, 70, 85].map((w, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 shrink-0 animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                      <div
                        className="h-3 rounded-full bg-stone-200 dark:bg-stone-700 animate-pulse"
                        style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                      />
                      <div
                        className="h-2.5 rounded-full bg-stone-100 dark:bg-stone-800 animate-pulse"
                        style={{ width: "45%", animationDelay: `${i * 80 + 40}ms` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="mb-4 p-4 rounded-2xl bg-stone-100 dark:bg-stone-800/50">
                  <MessageCircle
                    size={22}
                    className="text-muted-foreground/30"
                  />
                </div>
                <p className="text-xs text-muted-foreground/60 max-w-[160px] leading-relaxed">
                  {t("sessions.empty")}
                </p>
              </div>
            ) : (
              /* Grouped sessions */
              groups.map(({ key, label, sessions: groupSessions }) => (
                <div key={key}>
                  <p className="px-6 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                    {label}
                  </p>
                  {groupSessions.map((session) => (
                    <SessionItem
                      key={session.id}
                      {...session}
                      locale={locale}
                      onActivate={(id) => {
                        onSessionSelect(id);
                        onClose();
                      }}
                      onDelete={handleDelete}
                      isDeleting={deletingId === session.id}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
