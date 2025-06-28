"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { SignInForm } from "@/components/forms/SignInForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();
  const t = useTranslations();

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  // Don't render if authenticated (will redirect)
  if (status === "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t("auth.signInTitle")}</CardTitle>
          <CardDescription>{t("auth.signInDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm callbackUrl="/dashboard" />

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {t("auth.dontHaveAccount")}{" "}
            <Link href="/sign-up" className="text-primary hover:underline">
              {t("auth.signUpHere")}
            </Link>
          </div>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            {t("auth.bySigningIn")}{" "}
            <Link href="/terms" className="text-primary hover:underline">
              {t("auth.termsOfService")}
            </Link>{" "}
            {t("auth.and")}{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              {t("auth.privacyPolicy")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
