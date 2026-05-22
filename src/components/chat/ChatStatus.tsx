"use client";

import React from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatusState = "pending" | "success" | "error";

interface ChatStatusProps {
  state: StatusState;
  message: string;
}

const CONFIG: Record<
  StatusState,
  { Icon: typeof Loader2; color: string; spin: boolean }
> = {
  pending: { Icon: Loader2, color: "text-muted-foreground", spin: true },
  success: { Icon: Check, color: "text-success", spin: false },
  error: { Icon: AlertCircle, color: "text-destructive", spin: false },
};

export function ChatStatus({ state, message }: ChatStatusProps) {
  const { Icon, color, spin } = CONFIG[state];
  return (
    <div className={cn("flex items-center gap-2 text-xs font-medium", color)}>
      <Icon size={14} className={cn("shrink-0", spin && "animate-spin")} />
      <span>{message}</span>
    </div>
  );
}
