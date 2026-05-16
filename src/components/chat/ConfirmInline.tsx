"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ConfirmInlineProps {
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export function ConfirmInline({
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
}: ConfirmInlineProps) {
  const t = useTranslations("chat.confirm");
  const [resolved, setResolved] = useState(false);

  const handleConfirm = () => {
    setResolved(true);
    onConfirm();
  };

  const handleCancel = () => {
    setResolved(true);
    onCancel();
  };

  if (resolved) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <button
        onClick={handleConfirm}
        className={cn(
          "px-4 py-1.5 rounded-lg text-sm font-medium",
          "bg-destructive text-destructive-foreground",
          "hover:bg-destructive/90 transition-colors shadow-sm"
        )}
      >
        {confirmText ?? t("yes")}
      </button>
      <button
        onClick={handleCancel}
        className={cn(
          "px-4 py-1.5 rounded-lg text-sm font-medium",
          "bg-secondary text-secondary-foreground border border-border",
          "hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
        )}
      >
        {cancelText ?? t("no")}
      </button>
    </div>
  );
}
