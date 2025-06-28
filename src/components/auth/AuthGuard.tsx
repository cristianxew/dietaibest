"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, RefreshCw } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

/**
 * AuthGuard component for protecting routes and components
 * Provides comprehensive authentication checks with proper loading and error states
 */
export function AuthGuard({
  children,
  fallback,
  redirectTo = "/sign-in",
  requireAuth = true,
}: AuthGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      // Wait for session to load
      if (status === "loading") {
        return;
      }

      setIsChecking(false);

      // If authentication is required but user is not authenticated
      if (requireAuth && status === "unauthenticated") {
        console.info(
          `[AuthGuard] Redirecting unauthenticated user from ${pathname} to ${redirectTo}`
        );

        // Add current path as redirect parameter
        const redirectUrl = new URL(redirectTo, window.location.origin);
        if (pathname !== "/" && !pathname.startsWith("/sign-")) {
          redirectUrl.searchParams.set("redirect", pathname);
        }

        toast.error("Please sign in to access this page");
        router.push(redirectUrl.toString());
        return;
      }
    };

    // Set a timeout to avoid infinite loading states
    const timeoutId = setTimeout(() => {
      if (status === "loading") {
        setIsChecking(false);
        console.warn(
          "[AuthGuard] Session loading timeout, proceeding with current state"
        );
      }
    }, 10000);

    checkAccess();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [session, status, requireAuth, pathname, redirectTo, router]);

  /**
   * Retry access check (useful for network errors)
   */
  const retryAccess = () => {
    setIsChecking(true);
    // Force session refresh
    window.location.reload();
  };

  /**
   * Navigate back to safe location
   */
  const navigateBack = () => {
    router.push("/");
  };

  // Show loading state while checking authentication
  if (isChecking || status === "loading") {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-500 animate-pulse" />
            </div>
            <CardTitle>Checking Access</CardTitle>
            <CardDescription>
              Please wait while we verify your authentication...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="flex justify-center mb-4">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              This usually takes just a moment.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If authentication is not required, always show children
  if (!requireAuth) {
    return <>{children}</>;
  }

  // If user is authenticated, show children
  if (session) {
    return <>{children}</>;
  }

  // Fallback state - show retry option
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </div>
          <CardTitle className="text-amber-700 dark:text-amber-400">
            Authentication Required
          </CardTitle>
          <CardDescription>
            You need to sign in to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Please sign in to continue accessing this protected content.
          </p>
          <div className="space-y-2">
            <Button onClick={() => router.push("/sign-in")} className="w-full">
              Sign In
            </Button>
            <Button onClick={navigateBack} variant="outline" className="w-full">
              Go to Home
            </Button>
            <Button onClick={retryAccess} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Higher-order component for protecting pages
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  guardOptions?: Omit<AuthGuardProps, "children">
) {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard {...guardOptions}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

/**
 * Hook for checking authentication state
 */
export function useAuthGuard() {
  const { data: session, status } = useSession();

  const isAuthenticated = (): boolean => {
    return status === "authenticated" && !!session;
  };

  const isLoading = (): boolean => {
    return status === "loading";
  };

  const requiresSignIn = (): boolean => {
    return status === "unauthenticated";
  };

  return {
    session,
    status,
    isAuthenticated,
    isLoading,
    requiresSignIn,
  };
}
