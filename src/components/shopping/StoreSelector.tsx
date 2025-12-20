"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Store, Loader2, Save, KeyRound } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { RadioGroup } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import { StoreCard } from "./StoreCard";
import { ShoppingPreferencesForm } from "./ShoppingPreferencesForm";
import { StoreCredentialsForm } from "./StoreCredentialsForm";

import {
  shoppingPreferencesFormSchema,
  ShoppingPreferencesFormValues,
  StoreInfo,
  SupportedStore,
} from "@/types/shopping-preferences";
import {
  getShoppingPreferences,
  updateShoppingPreferences,
  getAvailableStores,
} from "@/actions/shopping-automation";

export function StoreSelector() {
  const t = useTranslations("shopping");
  const tCommon = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<StoreInfo[]>([]);

  const form = useForm<ShoppingPreferencesFormValues>({
    resolver: zodResolver(shoppingPreferencesFormSchema),
    defaultValues: {
      selectedStore: null,
      deliveryPreference: "delivery",
      zipCode: null,
      preferOrganic: false,
      preferStoreBrand: false,
      allowSubstitutions: true,
      maxPricePerItem: null,
    },
  });

  const selectedStore = form.watch("selectedStore");

  // Load stores and existing preferences on mount
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Load stores and preferences in parallel
        const [storesResult, prefsResult] = await Promise.all([
          getAvailableStores(),
          getShoppingPreferences(),
        ]);

        if (storesResult.data) {
          setStores(storesResult.data);
        }

        if (prefsResult.data) {
          // Populate form with existing preferences
          form.reset({
            selectedStore: prefsResult.data.selectedStore as SupportedStore | null,
            deliveryPreference: prefsResult.data.deliveryPreference as "delivery" | "pickup",
            zipCode: prefsResult.data.zipCode,
            preferOrganic: prefsResult.data.preferOrganic,
            preferStoreBrand: prefsResult.data.preferStoreBrand,
            allowSubstitutions: prefsResult.data.allowSubstitutions,
            maxPricePerItem: prefsResult.data.maxPricePerItem,
          });
        }
      } catch (error) {
        console.error("Failed to load store data:", error);
        toast.error(t("storeSelector.loadError"));
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [form, t]);

  const onSubmit = (data: ShoppingPreferencesFormValues) => {
    startTransition(async () => {
      const result = await updateShoppingPreferences(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("storeSelector.preferencesSaved"));
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          {t("storeSelector.title")}
        </CardTitle>
        <CardDescription>{t("storeSelector.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Store Selection Grid */}
            <FormField
              control={form.control}
              name="selectedStore"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                    >
                      {stores.map((store) => (
                        <StoreCard
                          key={store.id}
                          store={store}
                          isSelected={field.value === store.id}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Shopping Preferences */}
            <ShoppingPreferencesForm form={form} />

            {/* Submit Button */}
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                disabled={isPending}
                className="min-w-[140px]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {tCommon("saving")}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t("storeSelector.savePreferences")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* Store Credentials Section - Outside the preferences form */}
        {selectedStore && (
          <>
            <Separator className="my-6" />
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">
                  {t("storeSelector.storeCredentials")}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("storeSelector.storeCredentialsDesc")}
              </p>
              <StoreCredentialsForm
                store={selectedStore}
                storeName={
                  stores.find((s) => s.id === selectedStore)?.name ||
                  selectedStore
                }
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
