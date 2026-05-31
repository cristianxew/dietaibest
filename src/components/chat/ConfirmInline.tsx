"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ConfirmInlineProps {
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "primary";
}

export function ConfirmInline({
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = "destructive",
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
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        onClick={handleConfirm}
        className={cn(
          "rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity duration-150 hover:opacity-85",
          variant === "primary"
            ? "bg-primary text-primary-foreground"
            : "bg-destructive text-destructive-foreground"
        )}
      >
        {confirmText ?? t("yes")}
      </button>
      <button
        onClick={handleCancel}
        className="rounded-md border-[1.5px] border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted"
      >
        {cancelText ?? t("no")}
      </button>
    </div>
  );
}
