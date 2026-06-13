"use client";

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
  signOut: (redirectTo?: string) => Promise<void>;
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
 * Note: SessionProvider is provided by ClientProviders, so we don't need it here
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return <AuthContextProvider>{children}</AuthContextProvider>;
}

function AuthContextProvider({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);

  // Initialize token refresh with error handling
  const { refreshToken } = useTokenRefresh({
    refreshThreshold: 15, // 15 minutes before expiry (more conservative)
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
   * Enhanced sign out with comprehensive session cleanup
   */
  const signOut = async (redirectTo?: string): Promise<void> => {
    try {
      setError(null);

      // Import Supabase client for cleanup
      const { supabase } = await import("@/lib/supabase");
      const { signOut: nextAuthSignOut } = await import("next-auth/react");

      // Sign out from Supabase to clear server-side sessions
      const { error: supabaseError } = await supabase.auth.signOut();
      if (
        supabaseError &&
        !supabaseError.message.includes("session_not_found")
      ) {
        console.warn("Supabase sign out warning:", supabaseError);
      }

      // Clear browser storage
      try {
        localStorage.removeItem("supabase.auth.token");
        localStorage.removeItem("sb-auth-token");
        sessionStorage.clear();
      } catch (storageError) {
        console.warn("Storage cleanup warning:", storageError);
      }

      // Sign out from NextAuth (clears httpOnly cookies).
      // Default destination is the login page, not the marketing home.
      await nextAuthSignOut({
        callbackUrl: redirectTo || "/sign-in",
        redirect: true,
      });

      toast.success("Signed out successfully");
    } catch (err) {
      console.error("Sign out error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Sign out failed";
      setError(errorMessage);

      // Even if sign out fails, try to redirect to clear state
      try {
        window.location.href = redirectTo || "/sign-in";
      } catch {
        toast.error("Please refresh the page to complete sign out");
      }
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
