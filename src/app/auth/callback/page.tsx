"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

type AuthState = "loading" | "success" | "error" | "expired" | "invalid";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [message, setMessage] = useState<string>(
    "Processing your authentication..."
  );
  const [userEmail, setUserEmail] = useState<string>("");
  const [retryAttempts, setRetryAttempts] = useState(0);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get redirect URL from query params
        const redirectTo = searchParams.get("redirect") || "/dashboard";
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        // Handle URL-based errors (from Supabase)
        if (error) {
          console.error("Auth URL error:", error, errorDescription);
          if (error === "access_denied") {
            setAuthState("error");
            setMessage("Magic link access was denied or cancelled.");
          } else if (error === "invalid_request" || error === "invalid_grant") {
            setAuthState("expired");
            setMessage("The magic link has expired or is invalid.");
          } else {
            setAuthState("error");
            setMessage(
              errorDescription ||
                "Authentication failed due to an unknown error."
            );
          }
          return;
        }

        setMessage("Verifying your authentication...");

        // Handle Supabase auth session
        const { data: authData, error: authError } =
          await supabase.auth.getSession();

        if (authError) {
          console.error("Auth callback error:", authError);

          if (authError.message.includes("session_not_found")) {
            setAuthState("expired");
            setMessage(
              "Your session has expired. Please request a new magic link."
            );
          } else if (authError.message.includes("invalid_token")) {
            setAuthState("invalid");
            setMessage("The magic link is invalid or has already been used.");
          } else {
            setAuthState("error");
            setMessage("Authentication failed. Please try again.");
          }
          return;
        }

        if (authData.session?.user) {
          setMessage("Creating your session...");
          setUserEmail(authData.session.user.email || "");

          // Create NextAuth session with Supabase token
          const result = await signIn("credentials", {
            email: authData.session.user.email,
            supabaseToken: authData.session.access_token,
            redirect: false,
          });

          if (result?.error) {
            console.error("NextAuth session creation failed:", result.error);
            setAuthState("error");
            setMessage(
              "Failed to create your session. Please try signing in again."
            );
            return;
          }

          setAuthState("success");
          setMessage(
            "Authentication successful! Redirecting to your dashboard..."
          );
          toast.success("Successfully signed in!");

          // Redirect after a brief delay to show success state
          setTimeout(() => router.push(redirectTo), 1500);
        } else {
          // No session found - could be expired or invalid
          setAuthState("expired");
          setMessage(
            "No active session found. Your magic link may have expired."
          );
        }
      } catch (error) {
        console.error("Auth callback processing error:", error);
        setAuthState("error");
        setMessage("An unexpected error occurred during authentication.");
      }
    };

    handleAuthCallback();
  }, [router, searchParams, retryAttempts]);

  /**
   * Retry authentication process
   */
  const handleRetry = () => {
    setRetryAttempts((prev) => prev + 1);
    setAuthState("loading");
    setMessage("Retrying authentication...");
  };

  /**
   * Render content based on auth state
   */
  const renderContent = () => {
    switch (authState) {
      case "loading":
        return (
          <>
            <div className="flex justify-center mb-4">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        );

      case "success":
        return (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">
              Welcome back{userEmail ? `, ${userEmail.split("@")[0]}` : ""}!
            </h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        );

      case "expired":
        return (
          <>
            <div className="flex justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-2">
              Link Expired
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/sign-in">Request New Magic Link</Link>
              </Button>
              <Button
                variant="outline"
                onClick={handleRetry}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </>
        );

      case "error":
      case "invalid":
        return (
          <>
            <div className="flex justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
              Authentication Failed
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/sign-in">Back to Sign In</Link>
              </Button>
              {retryAttempts < 2 && (
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry ({2 - retryAttempts} attempts left)
                </Button>
              )}
            </div>
          </>
        );

      default:
        return (
          <p className="text-sm text-muted-foreground">
            Processing authentication...
          </p>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {authState === "success"
              ? "Authentication Complete"
              : "Magic Link Authentication"}
          </CardTitle>
          <CardDescription>
            {authState === "success"
              ? "You have been successfully signed in."
              : "Please wait while we verify your magic link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {renderContent()}

          {authState === "loading" && (
            <div className="text-xs text-muted-foreground mt-4">
              This usually takes just a few seconds...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
