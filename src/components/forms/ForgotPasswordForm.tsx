"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AUTH_RESET_PASSWORD_PATH,
  buildAuthRedirectUrl,
} from "@/lib/auth-links";

const createForgotPasswordSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t("validation.invalidEmail")),
  });

interface ForgotPasswordFormProps {
  onSuccess?: () => void;
}

export function ForgotPasswordForm({ onSuccess }: ForgotPasswordFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [isLoading, setIsLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const forgotPasswordSchema = createForgotPasswordSchema(t);
  type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: buildAuthRedirectUrl({
          origin: window.location.origin,
          locale,
          path: AUTH_RESET_PASSWORD_PATH,
        }),
      });

      if (error) {
        // Rate limiting is the one error worth surfacing verbatim; everything
        // else is reported as success so the form never reveals whether an
        // address is registered.
        console.error("Password reset request error:", error);
        if (error.status === 429) {
          toast.error(error.message);
          return;
        }
      }

      setSentTo(data.email);
      onSuccess?.();
    } catch (error) {
      console.error("Password reset request error:", error);
      toast.error(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  if (sentTo) {
    return (
      <div className="space-y-4 text-center">
        <h3 className="text-lg font-semibold">{t("auth.checkYourEmail")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("auth.forgotPassword.emailSentTo", { email: sentTo })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("auth.forgotPassword.emailInstructions")}
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            setSentTo(null);
            form.reset();
          }}
        >
          {t("auth.forgotPassword.sendAnother")}
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("common.email")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder={t("placeholders.enterEmail")}
                  autoComplete="email"
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading
            ? t("auth.sending")
            : t("auth.forgotPassword.sendResetLink")}
        </Button>
      </form>
    </Form>
  );
}
