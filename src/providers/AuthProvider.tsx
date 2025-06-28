"use client";

import { SessionProvider } from "next-auth/react";

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider wraps the NextAuth SessionProvider to provide authentication context
 * throughout the app. This enables the use of NextAuth hooks like useSession() in client components.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
