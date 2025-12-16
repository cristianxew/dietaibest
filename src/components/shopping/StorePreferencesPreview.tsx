"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Store, Settings, ChevronRight, Leaf, RefreshCw, Tag } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { getShoppingPreferences } from "@/actions/shopping-automation";
import { SupportedStore, SUPPORTED_STORE_LIST } from "@/types/shopping-preferences";
import { SUPPORTED_STORES } from "@/lib/browser-use";

export function StorePreferencesPreview() {
  const t = useTranslations("shopping");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<SupportedStore | null>(null);
  const [preferences, setPreferences] = useState<{
    preferOrganic: boolean;
    preferStoreBrand: boolean;
    allowSubstitutions: boolean;
  } | null>(null);

  useEffect(() => {
    async function loadPreferences() {
      setIsLoading(true);
      try {
        const result = await getShoppingPreferences();
        if (result.data) {
          setSelectedStore(result.data.selectedStore as SupportedStore | null);
          setPreferences({
            preferOrganic: result.data.preferOrganic,
            preferStoreBrand: result.data.preferStoreBrand,
            allowSubstitutions: result.data.allowSubstitutions,
          });
        }
      } catch (error) {
        console.error("Failed to load preferences:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPreferences();
  }, []);

  if (isLoading) {
    return (
      <Card className="border-border/60 bg-card/80 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="ml-auto">
              <Skeleton className="h-9 w-24 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const storeName = selectedStore
    ? SUPPORTED_STORES[selectedStore]?.name || selectedStore
    : null;

  // Store visual accents - background colors for the icon container
  const storeStyles: Record<string, string> = {
    auchan: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border-red-100 dark:border-red-900/30",
    frisco: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400 border-green-100 dark:border-green-900/30",
    carrefour: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
  };

  const currentStoreStyle = selectedStore && storeStyles[selectedStore]
    ? storeStyles[selectedStore]
    : "bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400 border-brand-100 dark:border-brand-900/30";

  return (

    <div className="group relative flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm transition-all hover:bg-card hover:shadow-sm">
      {selectedStore ? (
        <>
          {/* Compact Store Icon */}
          <div className={`flex items-center justify-center p-2 rounded-lg border ${currentStoreStyle} shrink-0`}>
            <Store className="w-4 h-4" />
          </div>

          {/* Compact Content */}
          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <h3 className="text-sm font-semibold text-foreground tracking-tight truncate">
              {storeName}
            </h3>
            <div className="hidden sm:block h-3 w-px bg-border" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
              {(preferences?.preferOrganic || preferences?.preferStoreBrand) && (
                <>
                  <span className="opacity-50">•</span>
                  <span>
                    {[
                      preferences?.preferOrganic && "Organic",
                      preferences?.preferStoreBrand && "Store Brand"
                    ].filter(Boolean).join(", ")}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Icon-only Action Button */}
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-70 group-hover:opacity-100" asChild>
            <Link href="/settings">
              <Settings className="w-4 h-4" />
              <span className="sr-only">{t("storeSelector.editPreferences")}</span>
            </Link>
          </Button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-center p-2 rounded-lg bg-muted shrink-0">
            <Store className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1 text-sm text-muted-foreground">
            {t("storeSelector.noStoreSelected")}
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" asChild>
            <Link href="/settings">
              {t("storeSelector.selectStore")}
              <ChevronRight className="w-3 h-3 opacity-50" />
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
