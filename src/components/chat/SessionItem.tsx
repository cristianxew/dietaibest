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
    <div
      className={cn(
        "group relative flex items-center gap-3 mx-3 my-0.5 px-3 py-3 rounded-xl",
        "cursor-pointer select-none transition-all duration-150",
        isActive
          ? "bg-brand-50 dark:bg-brand-950/30"
          : "hover:bg-stone-100/60 dark:hover:bg-stone-800/40",
        isDeleting && "opacity-50 pointer-events-none",
      )}
      onClick={() => !isDeleting && onActivate(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(id);
        }
      }}
    >
      {/* Active indicator dot */}
      <div
        className={cn(
          "shrink-0 w-1.5 h-1.5 rounded-full transition-all duration-200",
          isActive
            ? "bg-brand-500 scale-100 opacity-100"
            : "bg-muted-foreground/20 scale-75 opacity-0 group-hover:opacity-60",
        )}
      />

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-[13px] font-medium leading-tight truncate",
            isActive
              ? "text-brand-700 dark:text-brand-300"
              : "text-foreground",
          )}
        >
          {title ?? t("sessions.untitled")}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
          <span>{relativeDate(updatedAt, locale)}</span>
          <span className="opacity-40 text-[9px]">·</span>
          <span>{t("session.messages", { count: messageCount })}</span>
        </p>
      </div>

      {/* Delete button — appears on hover */}
      <button
        className={cn(
          "shrink-0 p-1.5 rounded-lg",
          "opacity-0 group-hover:opacity-100 focus:opacity-100",
          "text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10",
          "transition-all duration-150",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(id);
        }}
        disabled={isDeleting}
        aria-label={t("sessions.delete")}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
