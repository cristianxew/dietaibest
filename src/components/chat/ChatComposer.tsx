"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Send, Paperclip, X, Loader2, Image as ImageIcon, AlertCircle } from "lucide-react";
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
      className="relative shrink-0 border-t border-border bg-card p-4"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-2 z-10 flex items-center justify-center rounded-md border-2 border-dashed border-primary bg-background/80 backdrop-blur-sm">
          <p className="text-sm font-medium text-primary">
            {t("attach.dropImage")}
          </p>
        </div>
      )}

      {attachment && (
        <div
          className={cn(
            "mb-3 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm",
            attachment.phase === "error" && "text-destructive",
          )}
        >
          {attachment.phase === "uploading" ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-muted-foreground" />
          ) : attachment.phase === "error" ? (
            <AlertCircle size={16} className="shrink-0 text-destructive" />
          ) : (
            <ImageIcon size={16} className="shrink-0 text-muted-foreground" />
          )}
          <span
            className={cn(
              "flex-1 truncate font-medium",
              attachment.phase === "error" ? "text-destructive" : "text-foreground",
            )}
          >
            {attachment.phase === "error" ? attachment.message : attachment.file.name}
          </span>
          <button
            onClick={clearAttachment}
            aria-label={t("attach.remove")}
            className="flex shrink-0 items-center p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || !!attachment}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-[1.5px] border-border bg-card transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border"
          aria-label={t("attach.label")}
        >
          <Paperclip size={16} className="text-muted-foreground" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={t("placeholder")}
          rows={1}
          className="min-h-9 max-h-[120px] flex-1 resize-none rounded-md border-[1.5px] border-border bg-card px-3 py-2 text-sm leading-normal text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-brand-600 dark:hover:bg-brand-300"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
          aria-label={t("send")}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
