"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<string>("Processing authentication...");

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get redirect URL from query params
        const redirectTo = searchParams.get("redirect") || "/dashboard";

        // Handle Supabase auth session
        const { data: authData, error: authError } =
          await supabase.auth.getSession();

        if (authError) {
          console.error("Auth callback error:", authError);
          setStatus("Authentication failed. Redirecting to sign-in...");
          toast.error("Authentication failed. Please try signing in again.");
          setTimeout(() => router.push("/sign-in"), 2000);
          return;
        }

        if (authData.session?.user) {
          setStatus("Creating session...");

          // Create NextAuth session with Supabase token
          const result = await signIn("credentials", {
            email: authData.session.user.email,
            supabaseToken: authData.session.access_token,
            redirect: false,
          });

          if (result?.error) {
            console.error("NextAuth session creation failed:", result.error);
            setStatus("Session creation failed. Redirecting to sign-in...");
            toast.error(
              "Failed to create session. Please try signing in again."
            );
            setTimeout(() => router.push("/sign-in"), 2000);
            return;
          }

          setStatus("Authentication successful! Redirecting...");
          toast.success("Successfully signed in!");
          setTimeout(() => router.push(redirectTo), 1000);
        } else {
          // No session found - redirect to sign-in
          setStatus(
            "No authentication session found. Redirecting to sign-in..."
          );
          setTimeout(() => router.push("/sign-in"), 2000);
        }
      } catch (error) {
        console.error("Auth callback processing error:", error);
        setStatus("An unexpected error occurred. Redirecting to sign-in...");
        toast.error("An unexpected error occurred during authentication.");
        setTimeout(() => router.push("/sign-in"), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Processing Authentication</CardTitle>
          <CardDescription>
            Please wait while we complete your sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {isLoading && (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
            </div>
          )}
          <p className="text-sm text-muted-foreground">{status}</p>
        </CardContent>
      </Card>
    </div>
  );
}
