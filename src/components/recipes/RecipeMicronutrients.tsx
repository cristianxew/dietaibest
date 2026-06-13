"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MICRONUTRIENT_GROUPS } from "@/lib/nutrition-fields";

/** Accepts the full recipe object; only numeric nutrition keys are read. */
type NutritionValues = Record<string, unknown>;

const formatValue = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(1);

/**
 * Collapsible "full nutrition" panel for the recipe detail page. Sits below the
 * macro card and reveals the extended micronutrients (vitamins, minerals, etc.)
 * stored on the recipe. Only fields that actually have a value are rendered;
 * groups with no data are skipped entirely.
 */
export function RecipeMicronutrients({
  nutrition,
}: {
  nutrition: NutritionValues;
}) {
  const t = useTranslations("recipes");

  const groups = MICRONUTRIENT_GROUPS.map((group) => ({
    ...group,
    rows: group.fields.filter((field) => {
      const value = nutrition[field.key];
      return typeof value === "number" && value > 0;
    }),
  })).filter((group) => group.rows.length > 0);

  const hasData = groups.length > 0;

  return (
    <Accordion
      type="single"
      collapsible
      className="w-full bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden"
    >
      <AccordionItem value="micro" className="border-none">
        <AccordionTrigger className="px-4 py-4 hover:no-underline">
          <div className="flex items-center gap-2.5">
            <span className="font-display font-bold text-base text-foreground">
              {t("fullNutritionTitle")}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {t("nutritionPerServing")}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-5">
          {hasData ? (
            <div className="space-y-6">
              {groups.map((group) => (
                <div key={group.id}>
                  <h5 className="text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase mb-2">
                    {t(`microGroup.${group.id}`)}
                  </h5>
                  <div className="divide-y divide-border/40">
                    {group.rows.map((field) => (
                      <div
                        key={field.key}
                        className="flex items-center justify-between py-2 text-sm"
                      >
                        <span className="text-muted-foreground">
                          {field.label}
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {formatValue(nutrition[field.key] as number)}{" "}
                          {field.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-1">
              {t("noMicroData")}
            </p>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
