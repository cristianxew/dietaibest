"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ForgotPasswordForm } from "@/components/forms/ForgotPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const t = useTranslations();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-display">
            {t("auth.forgotPassword.title")}
          </CardTitle>
          <CardDescription>
            {t("auth.forgotPassword.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ForgotPasswordForm />

          <div className="text-center text-sm text-muted-foreground">
            <Link
              href="/sign-in"
              className="text-primary font-medium hover:underline"
            >
              {t("auth.forgotPassword.backToSignIn")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
