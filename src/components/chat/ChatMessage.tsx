"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChatStatus, StatusState } from "./ChatStatus";
import { ToolResultLink, LinkType } from "./ToolResultLink";
import { ConfirmInline } from "./ConfirmInline";

export type MessageRole = "user" | "agent" | "system";

export interface MessageContent {
  text?: string;
  attachment?: {
    url: string;
    name?: string;
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
  };
}

export interface ChatMessageProps {
  id: string;
  role: MessageRole;
  content: MessageContent;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  if (role === "system") {
    return (
      <div className="flex flex-col items-center justify-center my-4">
        <div className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800/50 border border-border text-center">
          <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
            {content.text}
          </p>
        </div>
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] flex flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Attachment preview for user message */}
        {isUser && content.attachment && (
          <div className="mb-1 rounded-xl overflow-hidden border border-border max-w-[200px]">
            <img 
              src={content.attachment.url} 
              alt={content.attachment.name || "Attachment"} 
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Text bubble */}
        {content.text && (
          <div
            className={cn(
              "px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed",
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-stone-100 dark:bg-stone-800 text-foreground rounded-tl-sm"
            )}
          >
            {content.text}
          </div>
        )}

        {/* Status indicator */}
        {!isUser && content.status && (
          <ChatStatus state={content.status.state} message={content.status.message} />
        )}

        {/* Result link */}
        {!isUser && content.link && (
          <ToolResultLink 
            type={content.link.type} 
            label={content.link.label} 
            href={content.link.href} 
          />
        )}

        {/* Inline confirmation */}
        {!isUser && content.confirm && (
          <ConfirmInline 
            onConfirm={content.confirm.onConfirm}
            onCancel={content.confirm.onCancel}
            confirmText={content.confirm.confirmText}
            cancelText={content.confirm.cancelText}
          />
        )}
      </div>
    </div>
  );
}
