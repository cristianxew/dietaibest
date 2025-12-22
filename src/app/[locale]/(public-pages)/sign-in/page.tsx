"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Icon } from "@iconify/react";
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
  const [showForm, setShowForm] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Timeout to show form after 2 seconds if stuck in loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "loading") {
        console.warn("[SignIn] Session loading timeout - showing form anyway");
        setShowForm(true);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [status]);

  // Show loading while checking session (with timeout fallback)
  if (status === "loading" && !showForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if authenticated (will redirect)
  if (status === "authenticated") {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 dark:opacity-15"
          style={{
            background: "radial-gradient(circle, var(--brand-200) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 dark:opacity-10"
          style={{
            background: "radial-gradient(circle, #FED7AA 0%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2.5 mb-8 group">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary shadow-lg shadow-primary/25 group-hover:shadow-xl transition-shadow">
            <Icon
              icon="solar:leaf-bold-duotone"
              width={22}
              className="text-primary-foreground"
            />
          </div>
          <span className="text-xl font-display font-semibold tracking-tight text-foreground">
            DietAI
          </span>
        </Link>

        <Card className="border-border shadow-xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-2xl font-display font-semibold text-foreground">
              {t("auth.signInTitle")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("auth.signInDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm callbackUrl="/dashboard" />

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t("auth.dontHaveAccount")}{" "}
              <Link href="/sign-up" className="text-primary font-medium hover:underline">
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
    </div>
  );
}
