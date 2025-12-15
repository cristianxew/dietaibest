"use client";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { UseFormReturn } from "react-hook-form";
import { ShoppingPreferencesFormValues } from "@/types/shopping-preferences";
import { Truck, MapPin, Leaf, Tag, RefreshCw, DollarSign } from "lucide-react";

interface ShoppingPreferencesFormProps {
  form: UseFormReturn<ShoppingPreferencesFormValues>;
}

export function ShoppingPreferencesForm({ form }: ShoppingPreferencesFormProps) {
  const t = useTranslations("shopping");

  return (
    <div className="space-y-6">
      {/* Delivery Preference */}
      <FormField
        control={form.control}
        name="deliveryPreference"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormLabel className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              {t("storeSelector.deliveryPreference")}
            </FormLabel>
            <FormControl>
              <RadioGroup
                onValueChange={field.onChange}
                defaultValue={field.value}
                className="flex gap-4"
              >
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="delivery" id="delivery" />
                  </FormControl>
                  <FormLabel htmlFor="delivery" className="font-normal cursor-pointer">
                    {t("storeSelector.delivery")}
                  </FormLabel>
                </FormItem>
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <RadioGroupItem value="pickup" id="pickup" />
                  </FormControl>
                  <FormLabel htmlFor="pickup" className="font-normal cursor-pointer">
                    {t("storeSelector.pickup")}
                  </FormLabel>
                </FormItem>
              </RadioGroup>
            </FormControl>
          </FormItem>
        )}
      />

      {/* Zip Code */}
      <FormField
        control={form.control}
        name="zipCode"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {t("storeSelector.zipCode")}
            </FormLabel>
            <FormControl>
              <Input
                placeholder={t("storeSelector.zipCodePlaceholder")}
                {...field}
                value={field.value ?? ""}
                className="max-w-[200px]"
              />
            </FormControl>
            <FormDescription className="text-xs">
              {t("storeSelector.zipCodeHint")}
            </FormDescription>
          </FormItem>
        )}
      />

      {/* Preferences Toggles */}
      <div className="space-y-4 pt-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          {t("storeSelector.preferences")}
        </h4>

        {/* Prefer Organic */}
        <FormField
          control={form.control}
          name="preferOrganic"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="flex items-center gap-2 text-base cursor-pointer">
                  <Leaf className="h-4 w-4 text-sage-500" />
                  {t("storeSelector.preferOrganic")}
                </FormLabel>
                <FormDescription className="text-xs">
                  {t("storeSelector.preferOrganicDesc")}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Prefer Store Brand */}
        <FormField
          control={form.control}
          name="preferStoreBrand"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="flex items-center gap-2 text-base cursor-pointer">
                  <Tag className="h-4 w-4 text-gold-500" />
                  {t("storeSelector.preferStoreBrand")}
                </FormLabel>
                <FormDescription className="text-xs">
                  {t("storeSelector.preferStoreBrandDesc")}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Allow Substitutions */}
        <FormField
          control={form.control}
          name="allowSubstitutions"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <FormLabel className="flex items-center gap-2 text-base cursor-pointer">
                  <RefreshCw className="h-4 w-4 text-brand-500" />
                  {t("storeSelector.allowSubstitutions")}
                </FormLabel>
                <FormDescription className="text-xs">
                  {t("storeSelector.allowSubstitutionsDesc")}
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Max Price Per Item */}
        <FormField
          control={form.control}
          name="maxPricePerItem"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                {t("storeSelector.maxPricePerItem")}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="100"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value ? parseFloat(value) : null);
                  }}
                  className="max-w-[150px]"
                />
              </FormControl>
              <FormDescription className="text-xs">
                {t("storeSelector.maxPricePerItemDesc")}
              </FormDescription>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
