"use client";

import { SessionProvider } from "next-auth/react";
import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
} from "react";
import { useSession } from "next-auth/react";
import { useTokenRefresh } from "@/hooks/use-token-refresh";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  provider?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Enhanced AuthProvider that provides comprehensive authentication state management
 * Includes automatic token refresh, error handling, and auth actions
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider>
      <AuthContextProvider>{children}</AuthContextProvider>
    </SessionProvider>
  );
}

function AuthContextProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);

  // Initialize token refresh with error handling
  const { refreshToken } = useTokenRefresh({
    refreshThreshold: 5, // 5 minutes before expiry
    onRefreshSuccess: () => {
      setError(null);
      console.log("Token refreshed successfully");
    },
    onRefreshError: (errorMessage) => {
      setError(`Authentication error: ${errorMessage}`);
      toast.error("Session expired. Please sign in again.");
    },
    enableAutoRefresh: true,
  });

  // Extract user info from session
  const user: User | null = session?.user
    ? {
        id: (session.user as { id?: string }).id || "unknown",
        email: session.user.email || "",
        name: session.user.name || undefined,
        image: session.user.image || undefined,
        provider: (session.user as { provider?: string }).provider || undefined,
      }
    : null;

  // Monitor session changes for errors
  useEffect(() => {
    if (status === "unauthenticated" && error) {
      setError(null); // Clear error when signed out
    }
  }, [status, error]);

  /**
   * Sign out the user and clear all auth state
   */
  const signOut = async (): Promise<void> => {
    try {
      setError(null);
      const { signOut: nextAuthSignOut } = await import("next-auth/react");
      await nextAuthSignOut({ callbackUrl: "/" });
      toast.success("Signed out successfully");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Sign out failed";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  };

  /**
   * Manually refresh the user session
   */
  const refreshSession = async (): Promise<boolean> => {
    try {
      setError(null);
      const success = await refreshToken();
      if (success) {
        toast.success("Session refreshed");
      }
      return success;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Refresh failed";
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    }
  };

  /**
   * Clear any authentication errors
   */
  const clearError = (): void => {
    setError(null);
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    error,
    signOut,
    refreshSession,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

/**
 * Hook to use the enhanced authentication context
 * Provides user state, auth actions, and error handling
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
