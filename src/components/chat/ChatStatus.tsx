"use client";

import React from "react";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusState = "pending" | "success" | "error";

interface ChatStatusProps {
  state: StatusState;
  message: string;
}

export function ChatStatus({ state, message }: ChatStatusProps) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 mb-2 w-max rounded-lg bg-stone-50 dark:bg-stone-800/50 border border-stone-200/50 dark:border-stone-700/50">
      {state === "pending" && (
        <Loader2 size={14} className="text-brand-500 animate-spin" />
      )}
      {state === "success" && (
        <CheckCircle2 size={14} className="text-sage-500" />
      )}
      {state === "error" && (
        <AlertTriangle size={14} className="text-amber-500" />
      )}
      <span className={cn(
        "text-xs font-medium",
        state === "pending" ? "text-stone-600 dark:text-stone-300" : "",
        state === "success" ? "text-sage-700 dark:text-sage-400" : "",
        state === "error" ? "text-amber-700 dark:text-amber-400" : ""
      )}>
        {message}
      </span>
    </div>
  );
}
