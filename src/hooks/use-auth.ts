"use client";

import { useCallback } from "react";
import {
  useSession,
  signIn,
  signOut as nextAuthSignOut,
} from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import {
  AUTH_CALLBACK_PATH,
  AUTH_RESET_PASSWORD_PATH,
  buildAuthRedirectUrl,
} from "@/lib/auth-links";

/**
 * Core authentication hook
 * Provides access to session, user data, and authentication state
 */
export function useAuth() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const user = session?.user || null;
  const isAuthenticated = status === "authenticated" && !!session;
  const isLoading = status === "loading";
  const isUnauthenticated = status === "unauthenticated";

  /**
   * Enhanced sign out with comprehensive cleanup
   */
  const signOut = useCallback(
    async (redirectTo?: string) => {
      try {
        // Clear Supabase session
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

        // Sign out from NextAuth
        await nextAuthSignOut({
          callbackUrl: redirectTo || "/",
          redirect: false,
        });

        // Navigate to destination
        router.push(redirectTo || "/");
        toast.success("Signed out successfully");
      } catch (error) {
        console.error("Sign out error:", error);
        toast.error("Error signing out");
        // Force navigation even on error
        router.push(redirectTo || "/");
      }
    },
    [router]
  );

  /**
   * Refresh the current session
   */
  const refreshSession = useCallback(async () => {
    try {
      await update();
      return true;
    } catch (error) {
      console.error("Session refresh error:", error);
      return false;
    }
  }, [update]);

  return {
    // State
    session,
    user,
    status,
    isAuthenticated,
    isLoading,
    isUnauthenticated,

    // Actions
    signOut,
    refreshSession,
  };
}

/**
 * Hook for protecting routes client-side
 */
export function useRequireAuth(redirectTo?: string) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const checkAuth = useCallback(() => {
    if (!isLoading && !isAuthenticated) {
      const signInUrl = redirectTo || "/sign-in";
      router.push(signInUrl);
      toast.error("Please sign in to access this page");
      return false;
    }
    return isAuthenticated;
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return {
    isAuthenticated,
    isLoading,
    checkAuth,
  };
}

/**
 * Hook for handling sign-in flows
 */
export function useSignIn() {
  const locale = useLocale();

  /**
   * Sign in with email and password
   */
  const signInWithCredentials = useCallback(
    async (email: string, password: string) => {
      try {
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (result?.error) {
          throw new Error(result.error);
        }

        return { success: true, error: null };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Sign in failed";
        return { success: false, error: message };
      }
    },
    []
  );

  /**
   * Sign in with Google OAuth
   */
  const signInWithGoogle = useCallback(async (callbackUrl?: string) => {
    try {
      await signIn("google", {
        callbackUrl: callbackUrl || "/dashboard",
        redirect: true,
      });
      return { success: true, error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google sign in failed";
      return { success: false, error: message };
    }
  }, []);

  /**
   * Sign in with magic link
   */
  const signInWithMagicLink = useCallback(
    async (email: string, callbackUrl?: string) => {
      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: buildAuthRedirectUrl({
              origin: window.location.origin,
              locale,
              path: AUTH_CALLBACK_PATH,
              params: { redirect: callbackUrl || "/dashboard" },
            }),
          },
        });

        if (error) {
          throw error;
        }

        return { success: true, error: null };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Magic link failed";
        return { success: false, error: message };
      }
    },
    [locale]
  );

  /**
   * Send a password-reset email. Only a rate-limit error is surfaced; anything
   * else resolves as success so callers cannot probe which addresses exist.
   */
  const requestPasswordReset = useCallback(
    async (email: string) => {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: buildAuthRedirectUrl({
            origin: window.location.origin,
            locale,
            path: AUTH_RESET_PASSWORD_PATH,
          }),
        });

        if (error && error.status === 429) {
          return { success: false, error: error.message };
        }

        return { success: true, error: null };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Password reset failed";
        return { success: false, error: message };
      }
    },
    [locale]
  );

  return {
    signInWithCredentials,
    signInWithGoogle,
    signInWithMagicLink,
    requestPasswordReset,
  };
}

/**
 * Hook for handling sign-up flows
 */
export function useSignUp() {
  /**
   * Sign up with email and password
   */
  const signUpWithCredentials = useCallback(
    async (
      email: string,
      password: string,
      metadata?: { firstName?: string; lastName?: string }
    ) => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: metadata?.firstName,
              last_name: metadata?.lastName,
              full_name:
                metadata?.firstName && metadata?.lastName
                  ? `${metadata.firstName} ${metadata.lastName}`
                  : undefined,
            },
          },
        });

        if (error) {
          throw error;
        }

        return {
          success: true,
          error: null,
          user: data.user,
          needsConfirmation: !data.session,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Sign up failed";
        return {
          success: false,
          error: message,
          user: null,
          needsConfirmation: false,
        };
      }
    },
    []
  );

  return {
    signUpWithCredentials,
  };
}

/**
 * Hook for handling authentication redirects
 */
export function useAuthRedirect() {
  const router = useRouter();

  /**
   * Redirect to sign-in with optional return URL
   */
  const redirectToSignIn = useCallback(
    (returnUrl?: string) => {
      const signInUrl = new URL("/sign-in", window.location.origin);
      if (returnUrl) {
        signInUrl.searchParams.set("redirect", returnUrl);
      }
      router.push(signInUrl.toString());
    },
    [router]
  );

  /**
   * Redirect to dashboard or specified URL after successful auth
   */
  const redirectAfterAuth = useCallback(
    (defaultUrl = "/dashboard") => {
      const urlParams = new URLSearchParams(window.location.search);
      const redirectTo = urlParams.get("redirect") || defaultUrl;
      router.push(redirectTo);
    },
    [router]
  );

  return {
    redirectToSignIn,
    redirectAfterAuth,
  };
}

/**
 * Utility hook for checking if user is on auth pages
 */
export function useAuthPages() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const isOnAuthPage = useCallback((pathname: string) => {
    return ["/sign-in", "/sign-up", "/auth"].some((authPath) =>
      pathname.startsWith(authPath)
    );
  }, []);

  const redirectAuthenticatedUser = useCallback(
    (pathname: string, redirectTo = "/dashboard") => {
      if (isAuthenticated && isOnAuthPage(pathname)) {
        router.push(redirectTo);
        return true;
      }
      return false;
    },
    [isAuthenticated, isOnAuthPage, router]
  );

  return {
    isOnAuthPage,
    redirectAuthenticatedUser,
  };
}
