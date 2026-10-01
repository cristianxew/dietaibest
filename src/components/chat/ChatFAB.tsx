"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { MEDIA_QUERY } from "@/lib/responsive";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useHideOnAnyScroll } from "@/hooks/use-hide-on-scroll";
import { LogoSymbol } from "./LogoSymbol";

interface ChatFABProps {
  isOpen: boolean;
  onClick: () => void;
}

const ARC_GRADIENT =
  "conic-gradient(from 0deg, transparent 0%, rgba(244,123,92,0.85) 28%, rgba(255,195,165,1) 50%, rgba(244,123,92,0.85) 72%, transparent 100%)";

export function ChatFAB({ isOpen, onClick }: ChatFABProps) {
  const t = useTranslations("chat");
  // Below lg the FAB covers content mid-scroll (and the meal rows' remove
  // buttons), so it slides away on scroll down and returns on scroll up, like
  // the planner's toolbar. Never while the chat is open.
  const belowDesktop = useMediaQuery(MEDIA_QUERY.belowDesktop);
  const { ref, hidden } = useHideOnAnyScroll({ disabled: isOpen || !belowDesktop });

  return (
    <div
      ref={ref}
      aria-hidden={hidden || undefined}
      inert={hidden}
      className={cn(
        "fixed bottom-6 z-40 h-14 w-14 transition-[right,translate,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        isOpen ? "right-[444px]" : "right-6",
        hidden && "pointer-events-none translate-y-[calc(100%+2rem)] opacity-0",
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
          "absolute inset-0 flex items-center justify-center rounded-full shadow-lg",
          "transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "glow-success",
          isOpen
            ? "scale-95 bg-sage-600 dark:bg-sage-200 text-white"
            : "scale-100 bg-sage-500 hover:scale-105 hover:bg-sage-600 dark:bg-sage-300 dark:hover:bg-sage-200 text-white",
        )}
      >
        <div className="relative flex items-center justify-center">
          <div className={cn(!isOpen && "animate-ai-float")}>
            <LogoSymbol size={28} tone="light" />
          </div>
          {!isOpen && (
            <span className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 bg-success",
              "border-sage-500 dark:border-sage-300"
            )} />
          )}
        </div>
      </button>
    </div>
  );
}
