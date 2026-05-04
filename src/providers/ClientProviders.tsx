"use client";

import { NextIntlClientProvider } from "next-intl";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { PaywallProvider } from "@/components/billing/PaywallProvider";
import { Paywall } from "@/components/billing/Paywall";

interface ClientProvidersProps {
  children: React.ReactNode;
  messages: Record<string, unknown>;
  locale: string;
  timeZone?: string;
}

export function ClientProviders({
  children,
  messages,
  locale = "en",
  timeZone = "UTC",
}: ClientProvidersProps) {
  return (
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
      timeZone={timeZone}
    >
      <SessionProvider>
        <AuthProvider>
          <PaywallProvider>
            {children}
            <Paywall />
            <Toaster />
          </PaywallProvider>
        </AuthProvider>
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
