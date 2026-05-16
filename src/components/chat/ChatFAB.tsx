"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatFABProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ChatFAB({ isOpen, onClick }: ChatFABProps) {
  const t = useTranslations("chat");
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? t("close") : t("title")}
      aria-expanded={isOpen}
      aria-controls="chat-drawer"
      className={cn(
        "fixed bottom-6 right-6 z-40 flex items-center justify-center",
        "w-14 h-14 rounded-full shadow-xl shadow-brand-500/25",
        "transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-2xl",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        isOpen
          ? "bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 rotate-90 scale-90 md:right-[444px]"
          : "bg-primary text-primary-foreground rotate-0"
      )}
    >
      <div className="relative w-6 h-6 flex items-center justify-center">
        <Sparkles
          className={cn(
            "absolute transition-all duration-300",
            isOpen ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0"
          )}
          size={24}
        />
        <X
          className={cn(
            "absolute transition-all duration-300",
            isOpen ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"
          )}
          size={24}
        />
      </div>
    </button>
  );
}
