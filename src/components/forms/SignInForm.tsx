"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Validation schemas using translations
const createEmailPasswordSchema = (
  t: (key: string, params?: Record<string, number>) => string
) =>
  z.object({
    email: z.string().email(t("validation.invalidEmail")),
    password: z.string().min(6, t("validation.passwordMinLength", { min: 6 })),
  });

const createMagicLinkSchema = (t: (key: string) => string) =>
  z.object({
    email: z.string().email(t("validation.invalidEmail")),
  });

interface SignInFormProps {
  callbackUrl?: string;
  onSuccess?: () => void;
}

export function SignInForm({
  callbackUrl = "/dashboard",
  onSuccess,
}: SignInFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("email");
  const t = useTranslations();

  // Create schemas with translations
  const emailPasswordSchema = createEmailPasswordSchema(t);
  const magicLinkSchema = createMagicLinkSchema(t);

  type EmailPasswordFormData = z.infer<typeof emailPasswordSchema>;
  type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

  // Email/Password form
  const emailPasswordForm = useForm<EmailPasswordFormData>({
    resolver: zodResolver(emailPasswordSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Magic Link form
  const magicLinkForm = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  /**
   * Handle email/password sign-in
   */
  const handleEmailPasswordSignIn = async (data: EmailPasswordFormData) => {
    try {
      setIsLoading(true);

      // First authenticate with Supabase
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (authData.user) {
        // Then sign in with NextAuth to create session
        const result = await signIn("credentials", {
          email: data.email,
          supabaseToken: authData.session?.access_token,
          redirect: false,
        });

        if (result?.error) {
          toast.error(t("errors.authError"));
          return;
        }

        toast.success(t("auth.successfullySignedIn"));
        onSuccess?.();
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error("Sign-in error:", error);
      toast.error(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle magic link sign-in
   */
  const handleMagicLinkSignIn = async (data: MagicLinkFormData) => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: `${window.location.origin
            }/auth/callback?redirect=${encodeURIComponent(callbackUrl)}`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(t("auth.magicLinkSent"));
      magicLinkForm.reset();
    } catch (error) {
      console.error("Magic link error:", error);
      toast.error(t("errors.magicLinkError"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google OAuth sign-in
   */
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);

      const result = await signIn("google", {
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        toast.error(t("errors.googleSignInError"));
        return;
      }

      if (result?.url) {
        toast.success(t("auth.redirectingToGoogle"));
        router.push(result.url);
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      toast.error(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="email">{t("auth.emailAndPassword")}</TabsTrigger>
          <TabsTrigger value="magic">{t("auth.magicLink")}</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4">
          <Form {...emailPasswordForm}>
            <form
              onSubmit={emailPasswordForm.handleSubmit(
                handleEmailPasswordSignIn
              )}
              className="space-y-4"
            >
              <FormField
                control={emailPasswordForm.control}
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

              <FormField
                control={emailPasswordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.password")}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t("placeholders.enterPassword")}
                        autoComplete="current-password"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? t("auth.signingIn") : t("auth.signIn")}
              </Button>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="magic" className="space-y-4">
          <Form {...magicLinkForm}>
            <form
              onSubmit={magicLinkForm.handleSubmit(handleMagicLinkSignIn)}
              className="space-y-4"
            >
              <FormField
                control={magicLinkForm.control}
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
                {isLoading ? t("auth.sending") : t("auth.sendMagicLink")}
              </Button>
            </form>
          </Form>

          <div className="text-sm text-muted-foreground">
            {t("auth.magicLinkDescription")}
          </div>
        </TabsContent>
      </Tabs>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("auth.orContinueWith")}
          </span>
        </div>
      </div>

      <Button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full"
        variant="outline"
      >
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {t("auth.continueWithGoogle")}
      </Button>
    </div>
  );
}
