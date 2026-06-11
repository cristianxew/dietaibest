"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

import {
  capabilities,
  type CapabilityGroup,
} from "@/lib/chat/capabilities";
import { resolvePageArea } from "@/lib/chat/page-context";

interface CapabilityMenuProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (prompt: string) => void;
}

const GROUP_ORDER: CapabilityGroup[] = [
  "recipes",
  "mealPlans",
  "nutrition",
  "import",
];

/**
 * Always-accessible "what can the assistant do" panel: the full capability
 * catalog grouped by area, mirroring HistoryPanel's slide-in overlay.
 * Selecting an entry pre-fills the composer and closes the panel.
 */
export function CapabilityMenu({
  visible,
  onClose,
  onSelect,
}: CapabilityMenuProps) {
  const t = useTranslations("chat");
  const tc = useTranslations("chat.capabilities");
  const pathname = usePathname();
  const locale = useLocale();
  const { entity } = resolvePageArea(pathname, locale);

  const groups = GROUP_ORDER.map((key) => ({
    key,
    label: t(`capabilityGroups.${key}`),
    items: capabilities.filter((c) => c.group === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className={cn(
        "absolute inset-0 z-[5] flex flex-col bg-background transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible
          ? "translate-x-0 shadow-[4px_0_16px_rgba(0,0,0,0.08)]"
          : "-translate-x-full"
      )}
      aria-hidden={!visible}
    >
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card p-4">
        <button
          onClick={onClose}
          aria-label={t("history.back")}
          className="flex items-center p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <h3 className="font-display text-lg font-semibold text-foreground">
          {t("capabilityMenu.title")}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => (
          <div key={group.key} className="mb-4">
            <div className="px-4 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </div>
            {group.items.map((cap) => {
              const Icon = cap.icon;
              const prompt =
                cap.entityAware && entity
                  ? tc(`${cap.id}.entityPrompt`)
                  : tc(`${cap.id}.prompt`);
              return (
                <button
                  key={cap.id}
                  onClick={() => onSelect(prompt)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <Icon size={16} className="shrink-0 text-primary" />
                  {tc(`${cap.id}.label`)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
