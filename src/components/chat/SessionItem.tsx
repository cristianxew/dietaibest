"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface SessionItemProps {
  id: string;
  title: string | null;
  updatedAt: string;
  messageCount: number;
  isActive: boolean;
  locale: string;
  onActivate: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function relativeDate(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (diff < 60_000) return rtf.format(0, "seconds");
  if (diff < 3_600_000) return rtf.format(-Math.floor(diff / 60_000), "minutes");
  if (diff < 86_400_000) return rtf.format(-Math.floor(diff / 3_600_000), "hours");
  return rtf.format(-Math.floor(diff / 86_400_000), "days");
}

export function SessionItem({
  id,
  title,
  updatedAt,
  messageCount,
  isActive,
  locale,
  onActivate,
  onDelete,
  isDeleting,
}: SessionItemProps) {
  const t = useTranslations("chat");

  return (
    <div className="group relative">
      <button
        onClick={() => onActivate(id)}
        disabled={isDeleting}
        className={cn(
          "w-full text-left px-4 py-3 transition-colors",
          isActive
            ? "bg-stone-100 dark:bg-stone-800"
            : "hover:bg-stone-50 dark:hover:bg-stone-900",
          isDeleting && "opacity-50 cursor-not-allowed"
        )}
      >
        <p className="text-sm font-medium text-foreground truncate pr-6">
          {title ?? t("sessions.untitled")}
        </p>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground">
            {relativeDate(updatedAt, locale)}
          </span>
          <span className="text-xs text-muted-foreground">
            {messageCount} {t("session.messages")}
          </span>
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
        disabled={isDeleting}
        aria-label={t("sessions.delete")}
        className={cn(
          "absolute top-2.5 right-2 p-1.5 rounded-md transition-all",
          "opacity-0 group-hover:opacity-100",
          "hover:text-destructive hover:bg-stone-100 dark:hover:bg-stone-800",
          "text-muted-foreground",
          isDeleting && "cursor-not-allowed"
        )}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
