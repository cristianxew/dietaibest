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
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

// Validation schema for sign-up with translations
const createSignUpSchema = (
  t: (key: string, params?: Record<string, number>) => string
) =>
  z
    .object({
      email: z.string().email(t("validation.invalidEmail")),
      password: z
        .string()
        .min(8, t("validation.passwordMinLength", { min: 8 }))
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          t("validation.passwordRequirements")
        ),
      confirmPassword: z.string(),
      firstName: z.string().min(2, t("validation.firstNameMinLength")),
      lastName: z.string().min(2, t("validation.lastNameMinLength")),
      acceptTerms: z.boolean().refine((val) => val === true, {
        message: t("validation.mustAcceptTerms"),
      }),
      marketingEmails: z.boolean(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordsDontMatch"),
      path: ["confirmPassword"],
    });

interface SignUpFormProps {
  callbackUrl?: string;
  onSuccess?: () => void;
}

export function SignUpForm({
  callbackUrl = "/dashboard",
  onSuccess,
}: SignUpFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations();

  // Create schema with translations
  const signUpSchema = createSignUpSchema(t);
  type SignUpFormData = z.infer<typeof signUpSchema>;

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      acceptTerms: false,
      marketingEmails: false,
    },
  });

  /**
   * Handle email/password sign-up
   */
  const handleSignUp = async (data: SignUpFormData) => {
    try {
      setIsLoading(true);

      // First create user with Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            first_name: data.firstName,
            last_name: data.lastName,
            full_name: `${data.firstName} ${data.lastName}`,
            marketing_emails: data.marketingEmails,
          },
          emailRedirectTo: `${
            window.location.origin
          }/auth/callback?redirect=${encodeURIComponent(callbackUrl)}`,
        },
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      if (authData.user) {
        // Check if user needs to confirm email
        if (!authData.session) {
          toast.success(t("auth.registrationSuccessful"), {
            duration: 8000,
          });
          form.reset();
          return;
        }

        // If email confirmation is disabled, sign in immediately
        const result = await signIn("credentials", {
          email: data.email,
          supabaseToken: authData.session?.access_token,
          redirect: false,
        });

        if (result?.error) {
          toast.error(t("auth.accountCreatedFailedSignIn"));
          router.push("/sign-in");
          return;
        }

        toast.success(t("auth.accountCreatedSignedIn"));
        onSuccess?.();
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error("Sign-up error:", error);
      toast.error(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle Google OAuth sign-up
   */
  const handleGoogleSignUp = async () => {
    try {
      setIsLoading(true);

      const result = await signIn("google", {
        callbackUrl,
        redirect: false,
      });

      if (result?.error) {
        toast.error(t("errors.googleSignUpError"));
        return;
      }

      if (result?.url) {
        toast.success(t("auth.redirectingToGoogle"));
        router.push(result.url);
      }
    } catch (error) {
      console.error("Google sign-up error:", error);
      toast.error(t("errors.generic"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Button
        onClick={handleGoogleSignUp}
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

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t("auth.orSignUpWithEmail")}
          </span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSignUp)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.firstName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("placeholders.enterFirstName")}
                      autoComplete="given-name"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.lastName")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("placeholders.enterLastName")}
                      autoComplete="family-name"
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("common.password")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="password"
                    placeholder={t("placeholders.createPassword")}
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
                    placeholder={t("placeholders.confirmPassword")}
                    autoComplete="new-password"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="acceptTerms"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal">
                    {t("auth.acceptTerms")}{" "}
                    <Link
                      href="/terms"
                      className="text-primary hover:underline"
                    >
                      {t("auth.termsOfService")}
                    </Link>{" "}
                    {t("auth.and")}{" "}
                    <Link
                      href="/privacy"
                      className="text-primary hover:underline"
                    >
                      {t("auth.privacyPolicy")}
                    </Link>
                  </FormLabel>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="marketingEmails"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isLoading}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="text-sm font-normal">
                    {t("auth.marketingEmails")}
                  </FormLabel>
                </div>
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t("auth.creatingAccount") : t("auth.createAccount")}
          </Button>
        </form>
      </Form>

      <div className="text-center text-sm text-muted-foreground">
        {t("auth.alreadyHaveAccount")}{" "}
        <Link href="/sign-in" className="text-primary hover:underline">
          {t("auth.signInHere")}
        </Link>
      </div>
    </div>
  );
}
