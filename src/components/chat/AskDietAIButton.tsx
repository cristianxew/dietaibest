"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { openChatWithPrompt } from "./openChat";

interface AskDietAIButtonProps {
  /** Composer prefill sent through the dietai:open-chat event. */
  prompt: string;
  children: React.ReactNode;
  className?: string;
}

/** Seeded chat entry point for pages outside the drawer. */
export function AskDietAIButton({
  prompt,
  children,
  className,
}: AskDietAIButtonProps) {
  return (
    <button
      onClick={() => openChatWithPrompt(prompt)}
      className={cn(
        "flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-muted",
        className
      )}
    >
      <Sparkles size={14} className="shrink-0 text-primary" />
      {children}
    </button>
  );
}
