"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { RefreshCw } from "lucide-react";
import {
  classifyAuthFailure,
  readAuthCallbackParams,
} from "@/lib/auth-links";
import { waitForSupabaseSession } from "@/lib/supabase-auth-session";

const createResetPasswordSchema = (
  t: (key: string, params?: Record<string, number>) => string
) =>
  z
    .object({
      password: z
        .string()
        .min(8, t("validation.passwordMinLength", { min: 8 }))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          t("validation.passwordRequirements")
        ),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordsDontMatch"),
      path: ["confirmPassword"],
    });

/** `checking` = resolving the recovery link; `ready` = the form is usable. */
type LinkState = "checking" | "ready" | "invalid";

export function ResetPasswordForm() {
  const t = useTranslations();
  const router = useRouter();
  const [linkState, setLinkState] = useState<LinkState>("checking");
  const [linkError, setLinkError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const resetPasswordSchema = createResetPasswordSchema(t);
  type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // A recovery link lands here with the session in the URL fragment. Resolve
  // it BEFORE showing the form, so the user never types a new password into a
  // page that cannot save it.
  useEffect(() => {
    let cancelled = false;

    const resolveRecoverySession = async () => {
      try {
        const params = readAuthCallbackParams(
          window.location.search,
          window.location.hash
        );

        if (params.error) {
          if (cancelled) return;
          setLinkState("invalid");
          setLinkError(
            classifyAuthFailure(params) === "expired"
              ? t("auth.resetPassword.linkExpired")
              : params.errorDescription || t("auth.resetPassword.linkInvalid")
          );
          return;
        }

        const session = await waitForSupabaseSession();
        if (cancelled) return;

        if (!session) {
          setLinkState("invalid");
          setLinkError(t("auth.resetPassword.linkExpired"));
          return;
        }

        setLinkState("ready");
      } catch (error) {
        console.error("Recovery link error:", error);
        if (cancelled) return;
        setLinkState("invalid");
        setLinkError(t("errors.generic"));
      }
    };

    resolveRecoverySession();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleSubmit = async (data: ResetPasswordFormData) => {
    try {
      setIsLoading(true);

      const { data: updated, error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(t("auth.resetPassword.passwordUpdated"));

      // Promote the recovery session to a full app session so the user lands
      // signed in instead of being bounced back to the sign-in form.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const email = updated.user?.email ?? sessionData.session?.user.email;

      if (accessToken && email) {
        const result = await signIn("credentials", {
          email,
          supabaseToken: accessToken,
          redirect: false,
        });

        if (!result?.error) {
          router.push("/dashboard");
          return;
        }
        console.error("NextAuth session creation failed:", result.error);
      }

      router.push("/sign-in");
    } catch (error) {
      console.error("Password update error:", error);
      toast.error(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  if (linkState === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {t("auth.resetPassword.verifyingLink")}
        </p>
      </div>
    );
  }

  if (linkState === "invalid") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{linkError}</p>
        <Button asChild className="w-full">
          <Link href="/forgot-password">
            {t("auth.resetPassword.requestNewLink")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.resetPassword.newPassword")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </FormControl>
              <FormDescription>
                {t("auth.passwordRequirements")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.confirmPassword")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading
            ? t("auth.resetPassword.updating")
            : t("auth.resetPassword.updatePassword")}
        </Button>
      </form>
    </Form>
  );
}
