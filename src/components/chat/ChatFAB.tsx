"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { LogoSymbol } from "./LogoSymbol";

interface ChatFABProps {
  isOpen: boolean;
  onClick: () => void;
}

const ARC_GRADIENT =
  "conic-gradient(from 0deg, transparent 0%, rgba(244,123,92,0.85) 28%, rgba(255,195,165,1) 50%, rgba(244,123,92,0.85) 72%, transparent 100%)";

export function ChatFAB({ isOpen, onClick }: ChatFABProps) {
  const t = useTranslations("chat");

  return (
    <div
      className={cn(
        "fixed bottom-6 z-40 h-14 w-14 transition-[right] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
        isOpen ? "right-[444px]" : "right-6",
      )}
    >
      {/* Spinning AI arc ring — fades out when the drawer is open */}
      <div
        className="pointer-events-none absolute -inset-[5px] rounded-full transition-opacity duration-200"
        style={{
          background: ARC_GRADIENT,
          animation: "spin 3s linear infinite",
          opacity: isOpen ? 0 : 1,
        }}
      />
      {/* Pulsing glow ring */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-full",
          !isOpen && "animate-ai-pulse",
        )}
      />
      {/* Button */}
      <button
        onClick={onClick}
        aria-label={isOpen ? t("close") : t("title")}
        aria-expanded={isOpen}
        aria-controls="chat-drawer"
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full text-primary-foreground shadow-lg",
          "transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isOpen
            ? "scale-95 bg-brand-600 dark:bg-brand-300"
            : "scale-100 bg-primary hover:scale-105 hover:bg-brand-600 dark:hover:bg-brand-300",
        )}
      >
        <div className="relative flex items-center justify-center">
          <div className={cn(!isOpen && "animate-ai-float")}>
            <LogoSymbol size={28} tone="light" />
          </div>
          {!isOpen && (
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-primary bg-success" />
          )}
        </div>
      </button>
    </div>
  );
}
