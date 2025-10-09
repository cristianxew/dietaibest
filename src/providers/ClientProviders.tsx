"use client";

import { NextIntlClientProvider } from "next-intl";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/sonner";

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
          {children}
          <Toaster />
        </AuthProvider>
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
