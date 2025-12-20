"use client";

import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DateRangePicker,
  type DateRange,
} from "@/components/custom-ui/date-picker";
import { ExportPdfDialog } from "./ExportPdfDialog";
import type {
  ShoppingListIngredient,
  ShoppingListRecipe,
} from "@/types/shopping-list";

interface ShoppingListHeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onGenerate: () => void;
  isLoading: boolean;
  /** Data for PDF export */
  pdfData?: {
    ingredients: ShoppingListIngredient[];
    recipes: ShoppingListRecipe[];
    dateRange: {
      startDate: string;
      endDate: string;
    };
    metadata: {
      totalRecipes: number;
      totalMeals: number;
    };
    purchasedAmounts: Record<string, number>;
  };
}

export function ShoppingListHeader({
  dateRange,
  onDateRangeChange,
  onGenerate,
  isLoading,
  pdfData,
}: ShoppingListHeaderProps) {
  const t = useTranslations("shopping");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Date Range Selection */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date Range Picker */}
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          className="h-9"
          placeholder={t("dateRangePlaceholder")}
        />

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={isLoading || !dateRange.from || !dateRange.to}
          className="gap-2"
        >
          {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
          {t("generate")}
        </Button>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Download PDF */}
        {pdfData ? (
          <ExportPdfDialog
            ingredients={pdfData.ingredients}
            recipes={pdfData.recipes}
            dateRange={pdfData.dateRange}
            metadata={pdfData.metadata}
            purchasedAmounts={pdfData.purchasedAmounts}
          />
        ) : (
          <ExportPdfDialog
            ingredients={[]}
            recipes={[]}
            dateRange={{ startDate: "", endDate: "" }}
            metadata={{ totalRecipes: 0, totalMeals: 0 }}
            purchasedAmounts={{}}
            disabled
          />
        )}
      </div>
    </div>
  );
}
