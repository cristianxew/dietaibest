"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UpgradeCTAProps {
  /** Show a compact single-line version for the sidebar */
  compact?: boolean;
}

/**
 * Persistent upgrade prompt. Render this only when `!isPro`.
 * Pass `compact` for the sidebar dock; full version suits settings / empty states.
 */
export function UpgradeCTA({ compact = false }: UpgradeCTAProps) {
  const t = useTranslations("billing.sidebar");

  if (compact) {
    return (
      <Button asChild variant="outline" size="sm" className="w-full gap-2">
        <Link href="/subscribe">
          <Sparkles className="size-3.5" aria-hidden />
          {t("upgradeButton")}
        </Link>
      </Button>
    );
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold">{t("upgradeTitle")}</p>
            <p className="text-xs text-muted-foreground">
              {t("upgradeDescription")}
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="w-full">
          <Link href="/subscribe">{t("upgradeButton")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
