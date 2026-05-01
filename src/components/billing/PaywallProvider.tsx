"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import type { EntitlementErrorPayload } from "@/lib/entitlement-error";

export type PaywallPayload = EntitlementErrorPayload;

interface PaywallContextValue {
  isOpen: boolean;
  payload: PaywallPayload | null;
  open: (payload: PaywallPayload) => void;
  close: () => void;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<PaywallPayload | null>(null);

  const open = useCallback((p: PaywallPayload) => setPayload(p), []);
  const close = useCallback(() => setPayload(null), []);

  return (
    <PaywallContext.Provider
      value={{ isOpen: payload !== null, payload, open, close }}
    >
      {children}
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error("usePaywall must be used inside <PaywallProvider>");
  }
  return ctx;
}
