"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormDescription,
} from "@/components/ui/form";

// Validation schema for magic link
const magicLinkSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

interface MagicLinkFormProps {
  callbackUrl?: string;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

export function MagicLinkForm({
  callbackUrl = "/dashboard",
  onSuccess,
  title = "Sign in with Magic Link",
  description = "Enter your email address and we'll send you a secure link to sign in.",
}: MagicLinkFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const form = useForm<MagicLinkFormData>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  /**
   * Handle magic link request
   */
  const handleMagicLinkRequest = async (data: MagicLinkFormData) => {
    try {
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: `${
            window.location.origin
          }/auth/callback?redirect=${encodeURIComponent(callbackUrl)}`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setIsEmailSent(true);
      toast.success("Magic link sent! Check your email to complete sign-in.");
      onSuccess?.();
    } catch (error) {
      console.error("Magic link error:", error);
      toast.error("Failed to send magic link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset form to send another magic link
   */
  const handleSendAnother = () => {
    setIsEmailSent(false);
    form.reset();
  };

  if (isEmailSent) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We&apos;ve sent a magic link to{" "}
            <strong>{form.getValues("email")}</strong>
          </p>
          <p className="text-sm text-muted-foreground">
            Click the link in your email to sign in. The link will expire in 1
            hour.
          </p>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
              What to expect:
            </h4>
            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Check your email inbox (and spam folder)</li>
              <li>• Click the magic link to sign in automatically</li>
              <li>• You&apos;ll be redirected back to DietAIbook</li>
              <li>• The link can only be used once</li>
            </ul>
          </div>
        </div>

        <div className="space-y-4">
          <Button
            onClick={handleSendAnother}
            variant="outline"
            className="w-full"
          >
            Send another link
          </Button>

          <div className="text-xs text-muted-foreground">
            Didn&apos;t receive the email? Check your spam folder or try sending
            another link.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleMagicLinkRequest)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="email"
                    placeholder="Enter your email"
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </FormControl>
                <FormDescription>
                  We&apos;ll send you a secure link to sign in without a
                  password.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Sending..." : "Send Magic Link"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
