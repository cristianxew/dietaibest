"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { MICRONUTRIENT_GROUPS } from "@/lib/nutrition-fields";
import { percentOfReference, type ReferenceIntakes } from "@/lib/nutrition-rda";
import type { MicronutrientSummary } from "@/types/meal-plan";

const formatValue = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(1);

interface MicronutrientPanelProps {
  /** Aggregated micronutrient totals (daily average or a single day). */
  micros: MicronutrientSummary;
  /** Reference intakes used to render %DV; personalized or standard. */
  reference: ReferenceIntakes;
  variant: "aggregate" | "day";
  className?: string;
}

/**
 * Collapsible micronutrient totals for the meal-plan view. Mirrors the recipe
 * detail "full nutrition" accordion (vitamins / minerals / other), adding a
 * %-of-daily-value figure and bar per nutrient. Goal nutrients aim toward 100%;
 * limit nutrients (sodium, saturated fat, …) warn when the limit is exceeded.
 * Fields with no value and empty groups are omitted.
 */
export function MicronutrientPanel({
  micros,
  reference,
  variant,
  className,
}: MicronutrientPanelProps) {
  const t = useTranslations("mealPlans.micronutrients");

  const groups = MICRONUTRIENT_GROUPS.map((group) => ({
    ...group,
    rows: group.fields.filter((field) => {
      const value = micros[field.key];
      return typeof value === "number" && value > 0;
    }),
  })).filter((group) => group.rows.length > 0);

  const hasData = groups.length > 0;

  return (
    <Accordion
      type="single"
      collapsible
      className={cn(
        "w-full bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden",
        className
      )}
    >
      <AccordionItem value="micros" className="border-none">
        <AccordionTrigger className="px-4 py-3.5 hover:no-underline">
          <div className="flex items-center gap-2.5">
            <span className="font-display font-bold text-base text-foreground">
              {t("title")}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {variant === "aggregate" ? t("dailyAverage") : t("perDay")}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-5">
          {hasData ? (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.id}>
                  <h5 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase mb-2">
                    {t(`group.${group.id}`)}
                  </h5>
                  <div className="divide-y divide-border/40">
                    {group.rows.map((field) => {
                      const value = micros[field.key];
                      const ref = reference.values[field.key];
                      const pct = percentOfReference(value, ref);
                      const isLimit = ref?.type === "limit";
                      const over = pct != null && pct > 100;
                      const barWidth = pct != null ? Math.min(pct, 100) : 0;
                      const barColor = isLimit
                        ? over
                          ? "bg-brand-500"
                          : "bg-gold-500"
                        : "bg-sage-500";

                      return (
                        <div key={field.key} className="py-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {field.label}
                            </span>
                            <span className="font-semibold text-foreground tabular-nums">
                              {formatValue(value)} {field.unit}
                              {pct != null && (
                                <span
                                  className={cn(
                                    "ml-2 text-[11px] font-medium",
                                    over
                                      ? "text-brand-500"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  {isLimit
                                    ? t("ofLimit", { pct })
                                    : t("ofTarget", { pct })}
                                </span>
                              )}
                            </span>
                          </div>
                          {ref && (
                            <div className="mt-1 h-[3px] bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-[width] duration-500",
                                  barColor
                                )}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground pt-1">
                {reference.source === "personalized"
                  ? t("sourcePersonalized")
                  : t("sourceStandard")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-1">{t("empty")}</p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
