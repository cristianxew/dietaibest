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
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const storeName = selectedStore
    ? SUPPORTED_STORES[selectedStore]?.name || selectedStore
    : null;

  // Store logo colors
  const storeColors: Record<string, string> = {
    auchan: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    frisco: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    carrefour: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">
              {t("storeSelector.title")}
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings" className="flex items-center gap-1">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t("storeSelector.editPreferences")}</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <CardDescription className="text-sm">
          {selectedStore
            ? t("storeSelector.previewDescription")
            : t("storeSelector.noStoreSelected")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {selectedStore ? (
          <div className="flex flex-wrap items-center gap-3">
            {/* Store Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                storeColors[selectedStore] || "bg-muted"
              }`}
            >
              <span className="font-semibold text-sm">{storeName}</span>
            </div>

            {/* Preference Badges */}
            {preferences?.preferOrganic && (
              <Badge variant="outline" className="gap-1">
                <Leaf className="h-3 w-3 text-sage-500" />
                {t("storeSelector.preferOrganic")}
              </Badge>
            )}
            {preferences?.preferStoreBrand && (
              <Badge variant="outline" className="gap-1">
                <Tag className="h-3 w-3 text-gold-500" />
                {t("storeSelector.preferStoreBrand")}
              </Badge>
            )}
            {preferences?.allowSubstitutions && (
              <Badge variant="outline" className="gap-1">
                <RefreshCw className="h-3 w-3 text-brand-500" />
                {t("storeSelector.allowSubstitutions")}
              </Badge>
            )}
          </div>
        ) : (
          <Button variant="outline" asChild className="w-full">
            <Link href="/settings" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              {t("storeSelector.selectStore")}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
