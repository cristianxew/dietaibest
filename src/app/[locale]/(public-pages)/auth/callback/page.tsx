"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
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
import {
  classifyAuthFailure,
  readAuthCallbackParams,
  safeRedirectPath,
} from "@/lib/auth-links";
import { waitForSupabaseSession } from "@/lib/supabase-auth-session";

type AuthState = "loading" | "success" | "error" | "expired" | "invalid";

function AuthCallbackContent() {
  const router = useRouter();
  const t = useTranslations();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [message, setMessage] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [retryAttempts, setRetryAttempts] = useState(0);

  const handleAuthCallback = useCallback(async () => {
    try {
      // Supabase runs the implicit flow: tokens AND errors come back in the
      // URL fragment, so the query string alone is not enough.
      const params = readAuthCallbackParams(
        window.location.search,
        window.location.hash
      );
      const redirectTo = safeRedirectPath(params.redirect);

      if (params.error) {
        console.error(
          "Auth URL error:",
          params.error,
          params.errorCode,
          params.errorDescription
        );

        switch (classifyAuthFailure(params)) {
          case "expired":
            setAuthState("expired");
            setMessage(t("auth.callback.linkExpiredMessage"));
            return;
          case "denied":
            setAuthState("error");
            setMessage(t("auth.callback.accessDenied"));
            return;
          case "invalid":
            setAuthState("invalid");
            setMessage(t("auth.callback.linkInvalid"));
            return;
          default:
            setAuthState("error");
            setMessage(params.errorDescription || t("errors.authError"));
            return;
        }
      }

      setMessage(t("auth.callback.verifying"));

      const session = await waitForSupabaseSession();

      if (!session?.user) {
        setAuthState("expired");
        setMessage(t("auth.callback.noSession"));
        return;
      }

      setMessage(t("auth.callback.creatingSession"));
      setUserEmail(session.user.email || "");

      // Mirror the Supabase session into a NextAuth session — NextAuth is the
      // app's session of record (middleware + server routes read its JWT).
      const result = await signIn("credentials", {
        email: session.user.email,
        supabaseToken: session.access_token,
        redirect: false,
      });

      if (result?.error) {
        console.error("NextAuth session creation failed:", result.error);
        setAuthState("error");
        setMessage(t("auth.callback.sessionFailed"));
        return;
      }

      setAuthState("success");
      setMessage(t("auth.callback.successRedirecting"));
      toast.success(t("auth.successfullySignedIn"));

      setTimeout(() => router.push(redirectTo), 1500);
    } catch (error) {
      console.error("Auth callback processing error:", error);
      setAuthState("error");
      setMessage(t("errors.generic"));
    }
  }, [router, t]);

  useEffect(() => {
    handleAuthCallback();
  }, [handleAuthCallback, retryAttempts]);

  const handleRetry = () => {
    setRetryAttempts((prev) => prev + 1);
    setAuthState("loading");
    setMessage(t("auth.callback.retrying"));
  };

  const renderContent = () => {
    switch (authState) {
      case "loading":
        return (
          <>
            <div className="flex justify-center mb-4">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
            <p className="text-sm text-muted-foreground">
              {message || t("auth.callback.processing")}
            </p>
          </>
        );

      case "success":
        return (
          <>
            <div className="flex justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">
              {userEmail
                ? t("auth.callback.welcomeBackNamed", {
                    name: userEmail.split("@")[0],
                  })
                : t("auth.callback.welcomeBack")}
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
              {t("auth.callback.linkExpired")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/sign-in">{t("auth.callback.requestNewLink")}</Link>
              </Button>
              <Button
                variant="outline"
                onClick={handleRetry}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("auth.callback.tryAgain")}
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
              {t("auth.callback.authenticationFailed")}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{message}</p>
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/sign-in">{t("auth.callback.tryAgain")}</Link>
              </Button>
              <Button
                variant="outline"
                onClick={handleRetry}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("auth.callback.retry")}
              </Button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("auth.callback.title")}</CardTitle>
          <CardDescription>{t("auth.callback.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="text-center py-12">
              <div className="flex justify-center mb-4">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
