"use client";

import React, { useState } from "react";
import {
  Copy,
  Pencil,
  Trash2,
  RotateCw,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { ChatStatus, StatusState } from "./ChatStatus";
import { ToolResultLink, LinkType } from "./ToolResultLink";
import { ConfirmInline } from "./ConfirmInline";
import { LogoSymbol } from "./LogoSymbol";

export type MessageRole = "user" | "agent" | "system";

export interface MessageContent {
  text?: string;
  attachment?: {
    url: string;
    name?: string;
    onDelete?: () => Promise<void> | void;
  };
  status?: {
    state: StatusState;
    message: string;
  };
  link?: {
    type: LinkType;
    label: string;
    href: string;
  };
  confirm?: {
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    variant?: "destructive" | "primary";
  };
}

export interface ChatMessageProps {
  id: string;
  role: MessageRole;
  content: MessageContent;
  /** Client-side time label (live messages only). */
  timestamp?: string;
  /** Agent text bubble currently receiving stream deltas. */
  streaming?: boolean;
  /** User message whose send failed — renders the "not delivered" affordance. */
  failed?: boolean;
  /** Agent message representing a transient/provider error. */
  error?: boolean;
  isLastUserMessage?: boolean;
  /** Last user turn AND not streaming — enables edit/delete (real backend). */
  canModify?: boolean;
  onRetry?: () => void;
  onCopied?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/** 32px avatar + space-3 gutter — keeps status/link rows aligned under text. */
const GUTTER = "ml-11";

function MsgActionBtn({
  Icon,
  label,
  onClick,
  danger,
}: {
  Icon: typeof Copy;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-[26px] w-[26px] items-center justify-center rounded-sm border border-border bg-card transition-all duration-150",
        danger
          ? "text-destructive hover:bg-muted"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon size={13} />
    </button>
  );
}

function UserMessage({
  content,
  timestamp,
  failed,
  canModify,
  onRetry,
  onCopied,
  onEdit,
  onDelete,
}: ChatMessageProps) {
  const t = useTranslations("chat");
  const [hovered, setHovered] = useState(false);

  const copy = () => {
    if (content.text) {
      navigator.clipboard?.writeText(content.text).catch(() => {});
      onCopied?.();
    }
  };

  return (
    <div
      className="mb-4 flex justify-end"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex max-w-[75%] flex-col items-end">
        {content.attachment && (
          <div className="group relative mb-1 max-w-[200px] overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.attachment.url}
              alt={content.attachment.name || "Attachment"}
              className="h-auto w-full object-cover"
            />
            {content.attachment.onDelete && (
              <button
                onClick={() => content.attachment?.onDelete?.()}
                aria-label={t("attach.delete")}
                title={t("attach.delete")}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {content.text && (
          <div
            className={cn(
              "rounded-lg rounded-br-[4px] px-4 py-3 text-sm leading-relaxed break-words",
              failed
                ? "border-[1.5px] border-dashed border-destructive bg-transparent text-destructive opacity-85"
                : "bg-primary text-white",
            )}
          >
            {content.text}
          </div>
        )}

        {failed ? (
          <div className="mt-2 flex items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertCircle size={12} />
              {t("notDelivered")}
            </span>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-sm bg-destructive px-3 py-1 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-85"
              >
                <RotateCw size={12} />
                {t("retry")}
              </button>
            )}
          </div>
        ) : (
          <>
            {timestamp && (
              <div className="mt-1 text-right text-xs text-muted-foreground">
                {timestamp}
              </div>
            )}
            <div
              className={cn(
                "mt-1 flex justify-end gap-1 transition-opacity duration-150",
                hovered ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <MsgActionBtn Icon={Copy} label={t("actions.copy")} onClick={copy} />
              {canModify && (
                <>
                  <MsgActionBtn
                    Icon={Pencil}
                    label={t("actions.edit")}
                    onClick={onEdit}
                  />
                  <MsgActionBtn
                    Icon={Trash2}
                    label={t("actions.delete")}
                    onClick={onDelete}
                    danger
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AgentMessage({
  content,
  timestamp,
  streaming,
  error,
  onRetry,
  onCopied,
}: ChatMessageProps) {
  const t = useTranslations("chat");
  const [hovered, setHovered] = useState(false);

  const copy = () => {
    if (content.text) {
      navigator.clipboard?.writeText(content.text).catch(() => {});
      onCopied?.();
    }
  };

  return (
    <div
      className="mb-4 flex gap-3"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
          error ? "bg-destructive" : "bg-muted",
        )}
      >
        {error ? (
          <AlertTriangle size={14} className="text-white" />
        ) : (
          <LogoSymbol size={22} tone="auto" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {content.text && (
          <div
            className={cn(
              "text-sm leading-relaxed",
              error ? "text-destructive" : "text-foreground",
            )}
          >
            {content.text}
            {streaming && (
              <span className="ml-0.5 inline-block h-3.5 w-[2px] animate-chat-blink bg-primary align-text-bottom" />
            )}
          </div>
        )}

        {content.confirm && (
          <ConfirmInline
            onConfirm={content.confirm.onConfirm}
            onCancel={content.confirm.onCancel}
            confirmText={content.confirm.confirmText}
            cancelText={content.confirm.cancelText}
            variant={content.confirm.variant}
          />
        )}

        {error && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-2 rounded-md border-[1.5px] border-destructive bg-card px-3 py-2 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-destructive hover:text-destructive-foreground"
          >
            <RotateCw size={13} />
            {t("retry")}
          </button>
        )}

        {timestamp && (
          <div className="mt-1 text-xs text-muted-foreground">{timestamp}</div>
        )}

        {!error && !streaming && content.text && (
          <div
            className={cn(
              "mt-1 flex gap-1 transition-opacity duration-150",
              hovered ? "opacity-100" : "pointer-events-none opacity-0",
            )}
          >
            <MsgActionBtn
              Icon={Copy}
              label={t("actions.copyResponse")}
              onClick={copy}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatMessage(props: ChatMessageProps) {
  const { role, content } = props;

  if (role === "system") {
    return (
      <div className="my-4 flex justify-center">
        <div className="rounded-xl border border-border bg-muted px-4 py-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {content.text}
          </p>
        </div>
      </div>
    );
  }

  if (role === "user") {
    return <UserMessage {...props} />;
  }

  // Agent: a message carries EITHER text (+confirm) OR a status (+link).
  if (content.text || content.confirm) {
    return (
      <>
        <AgentMessage {...props} />
        {content.link && (
          <div className={cn(GUTTER, "mb-4 -mt-2")}>
            <ToolResultLink
              type={content.link.type}
              label={content.link.label}
              href={content.link.href}
            />
          </div>
        )}
      </>
    );
  }

  // Status / tool-result row — aligned under the agent avatar.
  return (
    <div className={GUTTER}>
      {content.status && (
        <div className="mb-2">
          <ChatStatus
            state={content.status.state}
            message={content.status.message}
          />
        </div>
      )}
      {content.link && (
        <div className="mb-4">
          <ToolResultLink
            type={content.link.type}
            label={content.link.label}
            href={content.link.href}
          />
        </div>
      )}
    </div>
  );
}
