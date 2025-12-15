"use client";

import { FormControl, FormItem, FormLabel } from "@/components/ui/form";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StoreInfo } from "@/types/shopping-preferences";
import { useTranslations } from "next-intl";
import { Store, CheckCircle2 } from "lucide-react";

interface StoreCardProps {
  store: StoreInfo;
  isSelected: boolean;
}

/**
 * Store logo component - displays first letter as fallback
 */
function StoreLogo({ store }: { store: StoreInfo }) {
  // Color mapping for each store
  const storeColors: Record<string, { bg: string; text: string }> = {
    auchan: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-600 dark:text-red-400" },
    frisco: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
    carrefour: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-600 dark:text-blue-400" },
  };

  const colors = storeColors[store.id] || { bg: "bg-muted", text: "text-muted-foreground" };

  return (
    <div
      className={cn(
        "w-14 h-14 rounded-xl flex items-center justify-center",
        "transition-all duration-200",
        colors.bg
      )}
    >
      <span className={cn("text-2xl font-bold", colors.text)}>
        {store.name.charAt(0).toUpperCase()}
      </span>
    </div>
  );
}

export function StoreCard({ store, isSelected }: StoreCardProps) {
  const t = useTranslations("shopping");

  return (
    <FormItem>
      <FormControl>
        <RadioGroupItem
          value={store.id}
          id={store.id}
          className="peer sr-only"
        />
      </FormControl>
      <FormLabel
        htmlFor={store.id}
        className={cn(
          "flex flex-col items-center justify-between rounded-xl border-2 bg-popover p-4 cursor-pointer",
          "transition-all duration-200 ease-out",
          "hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 hover:shadow-md",
          "peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5",
          "[&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/5",
          "border-muted"
        )}
      >
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
        )}

        {/* Store Logo */}
        <StoreLogo store={store} />

        {/* Store Name */}
        <span className="font-semibold text-base mt-3">{store.name}</span>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
          {/* Country Badge */}
          <Badge variant="secondary" className="text-xs">
            {store.country}
          </Badge>

          {/* Automation Support Badge */}
          <Badge
            variant={store.automationSupport === "full" ? "default" : "outline"}
            className={cn(
              "text-xs",
              store.automationSupport === "full" &&
                "bg-sage-500 hover:bg-sage-600 text-white"
            )}
          >
            {store.automationSupport === "full"
              ? t("storeSelector.fullAutomation")
              : t("storeSelector.partialAutomation")}
          </Badge>
        </div>

        {/* Substitutions support indicator */}
        {store.supportsSubstitutions && (
          <span className="text-xs text-muted-foreground mt-2">
            {t("storeSelector.supportsSubstitutions")}
          </span>
        )}
      </FormLabel>
    </FormItem>
  );
}
