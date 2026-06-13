"use client";

import React from "react";
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
        "inline-flex items-center justify-center rounded-md border border-ai-200/80 dark:border-ai-800/60 bg-background px-3 py-2 text-xs font-medium text-ai shadow-xs transition-colors hover:bg-ai-50 dark:hover:bg-ai-950/40 hover:border-ai-300 dark:hover:border-ai-700 focus-visible:ring-2 focus-visible:ring-ai focus-visible:ring-offset-2 outline-none cursor-pointer disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}
