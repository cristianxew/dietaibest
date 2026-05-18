"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Send, Paperclip, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingAttachment } from "./useChatStream";

interface ChatComposerProps {
  onSend: (text: string, attachment?: PendingAttachment) => void;
  initialValue?: string;
  disabled?: boolean;
}

// DIE-41 — local state for the picked image. Tracks upload-to-server progress
// because the chat agent calls importRecipeFromImage(eventId), and the
// eventId only exists after /api/chat/upload returns.
type ComposerAttachment =
  | { phase: "uploading"; file: File; previewUrl: string }
  | {
      phase: "uploaded";
      file: File;
      previewUrl: string;
      eventId: string;
    }
  | { phase: "error"; file: File; previewUrl: string; message: string };

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function ChatComposer({
  onSend,
  initialValue = "",
  disabled = false,
}: ChatComposerProps) {
  const t = useTranslations("chat");
  const [text, setText] = useState(initialValue);
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(initialValue);
  }, [initialValue]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Revoke blob URLs when the attachment unmounts to avoid leaks.
  useEffect(() => {
    return () => {
      if (attachment) URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!ALLOWED_MIME.has(file.type.toLowerCase())) {
        alert(t("attach.unsupportedFormat"));
        return;
      }
      if (file.size > MAX_BYTES) {
        alert(t("attach.maxSize"));
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      setAttachment({ phase: "uploading", file, previewUrl });

      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/chat/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          const message =
            typeof payload?.error?.message === "string"
              ? payload.error.message
              : t("attach.failed");
          setAttachment({ phase: "error", file, previewUrl, message });
          return;
        }
        const data = (await res.json()) as { eventId: string };
        setAttachment({ phase: "uploaded", file, previewUrl, eventId: data.eventId });
      } catch {
        setAttachment({
          phase: "error",
          file,
          previewUrl,
          message: t("attach.failed"),
        });
      }
    },
    [t]
  );

  const clearAttachment = useCallback(async () => {
    if (!attachment) return;
    // Best-effort server-side delete if we already have an eventId. Local
    // state always clears regardless of network success.
    if (attachment.phase === "uploaded") {
      try {
        await fetch(`/api/chat/attachment/${attachment.eventId}`, {
          method: "DELETE",
        });
      } catch {
        /* swallow — we'll still clear UI */
      }
    }
    URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  }, [attachment]);

  const canSend =
    !disabled &&
    (text.trim().length > 0 || attachment?.phase === "uploaded") &&
    attachment?.phase !== "uploading";

  const handleSend = () => {
    if (!canSend) return;
    const pending: PendingAttachment | undefined =
      attachment?.phase === "uploaded"
        ? {
            eventId: attachment.eventId,
            kind: "image",
            previewUrl: attachment.previewUrl,
            name: attachment.file.name,
          }
        : undefined;
    onSend(text.trim(), pending);
    setText("");
    // Hand over previewUrl ownership to the parent message — don't revoke here.
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) await uploadFile(selected);
    // Reset input so the same file can be re-picked.
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped && dropped.type.startsWith("image/")) {
      await uploadFile(dropped);
    }
  };

  return (
    <div
      className={cn(
        "p-4 border-t border-border bg-background relative",
        isDragging && "bg-brand-50/50 dark:bg-brand-900/10"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-brand-400 rounded-lg m-2">
          <p className="text-brand-600 dark:text-brand-400 font-medium">
            {t("attach.dropImage")}
          </p>
        </div>
      )}

      {attachment && (
        <div className="mb-3 flex items-center gap-3 p-2 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 w-max pr-8 relative">
          <div className="w-10 h-10 rounded-md bg-stone-200 dark:bg-stone-700 overflow-hidden flex items-center justify-center shrink-0">
            <img
              src={attachment.previewUrl}
              alt={t("attach.label")}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium truncate max-w-[200px]">
              {attachment.file.name}
            </span>
            <span
              className={cn(
                "text-xs flex items-center gap-1",
                attachment.phase === "error"
                  ? "text-destructive"
                  : "text-muted-foreground"
              )}
            >
              {attachment.phase === "uploading" && (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  {t("attach.uploading")}
                </>
              )}
              {attachment.phase === "uploaded" &&
                `${(attachment.file.size / 1024 / 1024).toFixed(2)} MB`}
              {attachment.phase === "error" && attachment.message}
            </span>
          </div>
          <button
            onClick={clearAttachment}
            aria-label={t("attach.remove")}
            className="absolute top-1 right-1 p-1 rounded-full bg-stone-200/50 hover:bg-stone-300 dark:bg-stone-700/50 dark:hover:bg-stone-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div
        className={cn(
          "flex items-end gap-2 p-2 rounded-2xl border transition-colors",
          "bg-card",
          text.trim() ? "border-brand-300 dark:border-brand-500/50" : "border-input",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !!attachment}
          className="p-2 shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300 transition-colors disabled:opacity-50"
          aria-label={t("attach.label")}
        >
          <Paperclip size={20} />
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={handleFileChange}
          />
        </button>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={t("placeholder")}
          className="flex-1 max-h-[120px] min-h-[24px] py-2 bg-transparent resize-none focus:outline-none text-sm placeholder:text-muted-foreground disabled:cursor-not-allowed"
          rows={1}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "p-2 shrink-0 rounded-xl transition-all duration-200",
            canSend
              ? "bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:-translate-y-0.5"
              : "bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-600"
          )}
          aria-label={t("send")}
        >
          <Send
            size={18}
            className={cn(canSend ? "translate-x-0.5" : "")}
          />
        </button>
      </div>
    </div>
  );
}
