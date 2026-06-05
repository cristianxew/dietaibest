"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, Search, SearchX, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  isActive: boolean;
}

interface HistoryPanelProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  locale: string;
}

type GroupKey = "today" | "yesterday" | "lastWeek" | "older";
const GROUP_ORDER: GroupKey[] = ["today", "yesterday", "lastWeek", "older"];

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

function relativeDate(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diff < 60_000) return rtf.format(0, "seconds");
  if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), "minutes");
  if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), "hours");
  return rtf.format(-Math.floor(diff / 86_400_000), "days");
}

function HistoryItem({
  session,
  locale,
  onClick,
  onDelete,
  isDeleting,
}: {
  session: Session;
  locale: string;
  onClick: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const t = useTranslations("chat");
  const active = session.isActive;

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group cursor-pointer border-l-[3px] py-3 pr-4 transition-colors duration-150",
        active
          ? "border-primary bg-brand-50 pl-[calc(1rem-3px)] dark:bg-brand-950/40"
          : "border-transparent pl-4 hover:bg-muted",
        isDeleting && "pointer-events-none opacity-50",
      )}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex-1 truncate text-sm font-semibold leading-snug",
            active ? "text-primary" : "text-foreground",
          )}
        >
          {session.title ?? t("sessions.untitled")}
        </div>
        {active && (
          <span className="shrink-0 rounded-sm bg-success/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
            {t("history.active")}
          </span>
        )}
        {!active && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label={t("sessions.delete")}
            className="shrink-0 rounded-sm p-1 text-muted-foreground/50 opacity-0 transition-all duration-150 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{relativeDate(session.updatedAt, locale)}</span>
        <span>·</span>
        <span>{t("session.messages", { count: session.messageCount })}</span>
      </div>
    </div>
  );
}

export function HistoryPanel({
  visible,
  onClose,
  onSelect,
  onNewChat,
  locale,
}: HistoryPanelProps) {
  const t = useTranslations("chat");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } catch {
      /* swallow — empty list is fine */
    }
  }, []);

  useEffect(() => {
    if (visible) {
      setQuery("");
      fetchSessions();
    }
  }, [visible, fetchSessions]);

  const handleDelete = useCallback(async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  }, []);

  const groupLabel: Record<GroupKey, string> = {
    today: t("sessions.today"),
    yesterday: t("sessions.yesterday"),
    lastWeek: t("sessions.lastWeek"),
    older: t("sessions.older"),
  };

  const grouped = useMemo(() => {
    const filtered = query
      ? sessions.filter((s) =>
          (s.title ?? t("sessions.untitled"))
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
      : sessions;
    return GROUP_ORDER.map((key) => ({
      key,
      label: groupLabel[key],
      items: filtered.filter((s) => getGroupKey(new Date(s.updatedAt)) === key),
    })).filter((g) => g.items.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, query, t]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-[5] flex flex-col bg-background transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible ? "translate-x-0 shadow-[4px_0_16px_rgba(0,0,0,0.08)]" : "-translate-x-full",
      )}
      aria-hidden={!visible}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label={t("history.back")}
            className="flex items-center p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </button>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {t("sessions.title")}
          </h3>
        </div>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-600 dark:hover:bg-brand-300"
        >
          <Plus size={13} />
          {t("sessions.newChat")}
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="w-full rounded-md border-[1.5px] border-border bg-card py-2 pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground">
            <SearchX size={28} className="text-muted-foreground" />
            <div className="mt-3">
              {query
                ? t("history.noResults", { query })
                : t("sessions.empty")}
            </div>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.key} className="mb-4">
              <div className="px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              {group.items.map((session) => (
                <HistoryItem
                  key={session.id}
                  session={session}
                  locale={locale}
                  onClick={() => onSelect(session.id)}
                  onDelete={() => handleDelete(session.id)}
                  isDeleting={deletingId === session.id}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
