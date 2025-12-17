"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  KeyRound,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  Check,
  Shield,
} from "lucide-react";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import {
  SupportedStore,
  storeCredentialSchema,
  StoreCredentialFormValues,
} from "@/types/shopping-preferences";
import {
  saveStoreCredentials,
  getStoreCredentials,
  deleteStoreCredentials,
} from "@/actions/shopping-automation";

// ============================================================================
// Types
// ============================================================================

interface StoreCredentialsFormProps {
  store: SupportedStore;
  storeName: string;
}

// ============================================================================
// Component
// ============================================================================

export function StoreCredentialsForm({
  store,
  storeName,
}: StoreCredentialsFormProps) {
  const t = useTranslations("shopping.credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  const form = useForm<StoreCredentialFormValues>({
    resolver: zodResolver(storeCredentialSchema),
    defaultValues: {
      store,
      email: "",
      password: "",
    },
  });

  // Load existing credentials on mount
  useEffect(() => {
    async function loadCredentials() {
      setIsLoading(true);
      try {
        const result = await getStoreCredentials(store);
        if (result.data && !Array.isArray(result.data) && result.data.email) {
          setSavedEmail(result.data.email);
          form.setValue("email", result.data.email);
        }
      } catch (error) {
        console.error("Failed to load credentials:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadCredentials();
  }, [store, form]);

  // Update store value when prop changes
  useEffect(() => {
    form.setValue("store", store);
  }, [store, form]);

  const onSubmit = async (data: StoreCredentialFormValues) => {
    setIsSaving(true);
    try {
      const result = await saveStoreCredentials({
        store: data.store,
        email: data.email,
        password: data.password,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("saved"));
        setSavedEmail(data.email);
        form.setValue("password", ""); // Clear password field after save
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteStoreCredentials(store);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("deleted"));
        setSavedEmail(null);
        form.reset({ store, email: "", password: "" });
      }
    } catch {
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("loading")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">
              {storeName} {t("credentials")}
            </CardTitle>
          </div>
          {savedEmail && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              {t("credentialsSaved")}
            </Badge>
          )}
        </div>
        <CardDescription className="flex items-center gap-1 text-xs">
          <Shield className="h-3 w-3" />
          {t("encryptionNote")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder={t("emailPlaceholder")}
                      autoComplete="email"
                      {...field}
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
                  <FormLabel>{t("password")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder={
                          savedEmail
                            ? t("passwordPlaceholderExisting")
                            : t("passwordPlaceholder")
                        }
                        autoComplete="current-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormDescription className="text-xs">
                    {t("passwordHint")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={isSaving} className="flex-1">
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {savedEmail ? t("updateCredentials") : t("saveCredentials")}
              </Button>

              {savedEmail && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("deleteConfirmTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("deleteConfirmDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>
                        {t("delete")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
