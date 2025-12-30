"use client";

import { useTranslations } from "next-intl";
import { ShoppingCart, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyStateIcon } from "@/components/custom-ui/EmptyStateIcon";

interface EmptyStateProps {
  type: "no-data" | "no-schedules";
  onGenerate?: () => void;
}

export function EmptyState({ type, onGenerate }: EmptyStateProps) {
  const t = useTranslations("shopping");

  const IconComponent = type === "no-schedules" ? CalendarDays : ShoppingCart;

  const title =
    type === "no-schedules" ? t("noSchedules") : t("selectDateRange");

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-border bg-card">
      {/* Decorative gradient blobs */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brand-100/20 dark:bg-brand-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-gold-100/20 dark:bg-gold-500/5 blur-3xl pointer-events-none" />

      <div className="relative flex flex-col items-center justify-center text-center py-16 px-6">
        <EmptyStateIcon icon={IconComponent} size="lg" className="mb-6" />

        <h3 className="font-display font-bold text-2xl text-foreground mb-2">
          {title}
        </h3>

        <p className="text-muted-foreground max-w-md mb-8">
          {type === "no-schedules"
            ? t("noSchedulesDescription")
            : t("selectDateRangeDescription")}
        </p>

        {onGenerate && type === "no-data" && (
          <Button onClick={onGenerate} className="gap-2">
            <ShoppingCart className="w-4 h-4" />
            {t("generate")}
          </Button>
        )}
      </div>
    </div>
  );
}
