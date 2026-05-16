"use client";

import React, { useState, useEffect } from "react";
import { ChatFAB } from "./ChatFAB";
import { ChatDrawer } from "./ChatDrawer";
import { useAuth } from "@/providers/AuthProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { usePaywall } from "@/components/billing/PaywallProvider";

export function ChatContainer({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { isAuthenticated } = useAuth();
  const entitlements = useEntitlements();
  const paywall = usePaywall();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleToggle = () => {
    if (!isAuthenticated) return;

    if (entitlements.status === "ready" && !entitlements.data.features.aiChat) {
      paywall.open({ code: "PRO_ONLY", feature: "aiChat" });
      return;
    }

    setIsOpen((prev) => !prev);
  };

  const handleClose = () => setIsOpen(false);

  return (
    <div className="flex h-[calc(100vh-64px)] md:h-screen w-full relative overflow-hidden">
      <div
        id="main-content"
        className={`flex-1 h-full overflow-auto transition-all duration-300 ease-in-out ${
          isOpen && !isMobile ? "md:mr-[420px]" : ""
        }`}
        tabIndex={-1}
        aria-label="Main content"
      >
        {children}
      </div>

      {!isMobile && (
        <div
          id="chat-drawer"
          role="dialog"
          aria-modal="false"
          aria-label="DietAI Assistant"
          className={`absolute top-0 right-0 h-full bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 transition-transform duration-300 ease-in-out z-30 shadow-2xl ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
          style={{ width: 420 }}
        >
          <ChatDrawer onClose={handleClose} isMobile={false} isOpen={isOpen} />
        </div>
      )}

      {isMobile && (
        <div
          id="chat-drawer"
          role="dialog"
          aria-modal="false"
          aria-label="DietAI Assistant"
          className={`fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 transition-transform duration-300 ease-in-out shadow-[0_-10px_40px_rgba(0,0,0,0.1)] rounded-t-3xl h-[90vh] ${
            isOpen ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <ChatDrawer onClose={handleClose} isMobile={true} isOpen={isOpen} />
        </div>
      )}

      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity duration-300"
          onClick={handleClose}
        />
      )}

      {isAuthenticated && <ChatFAB isOpen={isOpen} onClick={handleToggle} />}
    </div>
  );
}
