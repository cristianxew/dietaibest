"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";

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
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        onClick={handleConfirm}
        className="rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-opacity duration-150 hover:opacity-85"
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
