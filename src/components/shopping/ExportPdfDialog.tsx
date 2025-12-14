"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Download, Loader2, FileText, LayoutGrid, UtensilsCrossed } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type {
  ShoppingListIngredient,
  ShoppingListRecipe,
} from "@/types/shopping-list";
import type {
  PDFExportOptions,
  PDFTranslations,
  PDFGenerationInput,
} from "@/types/pdf";

interface ExportPdfDialogProps {
  /** Consolidated ingredients for the shopping list */
  ingredients: ShoppingListIngredient[];
  /** Recipes with their ingredients */
  recipes: ShoppingListRecipe[];
  /** Date range for the shopping list */
  dateRange: {
    startDate: string;
    endDate: string;
  };
  /** Metadata about the shopping list */
  metadata: {
    totalRecipes: number;
    totalMeals: number;
  };
  /** Amount purchased per ingredient */
  purchasedAmounts: Record<string, number>;
  /** Whether the button should be disabled */
  disabled?: boolean;
}

export function ExportPdfDialog({
  ingredients,
  recipes,
  dateRange,
  metadata,
  purchasedAmounts,
  disabled = false,
}: ExportPdfDialogProps) {
  const t = useTranslations("shopping");
  const locale = useLocale();

  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"category" | "recipe">("category");
  const [includeChecked, setIncludeChecked] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Collect translations for the PDF
  const collectTranslations = (): PDFTranslations => ({
    title: t("pdf.title"),
    generatedBy: t("pdf.generatedBy"),
    page: t("pdf.page"),
    of: t("pdf.of"),
    items: t("items"),
    recipes: t("recipes"),
    servings: t("servings"),
    categories: {
      fruits: t("categories.fruits"),
      vegetables: t("categories.vegetables"),
      proteins: t("categories.proteins"),
      dairy: t("categories.dairy"),
      grains: t("categories.grains"),
      pantry: t("categories.pantry"),
      other: t("categories.other"),
    },
  });

  const handleExport = async () => {
    setIsGenerating(true);

    try {
      // Dynamic import for code splitting
      const { generateShoppingListPDF } = await import(
        "@/lib/pdf/shopping-list-pdf"
      );

      const input: PDFGenerationInput = {
        ingredients,
        recipes,
        dateRange,
        metadata,
        purchasedAmounts,
        locale,
      };

      const options: PDFExportOptions = {
        viewMode,
        includeCheckedItems: includeChecked,
      };

      const translations = collectTranslations();

      await generateShoppingListPDF(input, options, translations);

      // Close dialog after successful export
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={disabled}>
          <Download className="w-4 h-4" />
          {t("downloadPdf")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-500" />
            {t("pdf.exportTitle")}
          </DialogTitle>
          <DialogDescription>{t("pdf.exportDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* View Mode Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              {t("pdf.viewModeLabel")}
            </Label>
            <RadioGroup
              value={viewMode}
              onValueChange={(value) =>
                setViewMode(value as "category" | "recipe")
              }
              className="grid grid-cols-2 gap-3"
            >
              <Label
                htmlFor="category"
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  viewMode === "category"
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-border hover:border-border/80"
                )}
              >
                <RadioGroupItem value="category" id="category" />
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-sage-600 dark:text-sage-400" />
                  <span className="text-sm">{t("pdf.categoryView")}</span>
                </div>
              </Label>
              <Label
                htmlFor="recipe"
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  viewMode === "recipe"
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-border hover:border-border/80"
                )}
              >
                <RadioGroupItem value="recipe" id="recipe" />
                <div className="flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-gold-600 dark:text-gold-400" />
                  <span className="text-sm">{t("pdf.recipeView")}</span>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* Include Checked Items */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="include-checked"
              checked={includeChecked}
              onCheckedChange={(checked) =>
                setIncludeChecked(checked as boolean)
              }
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="include-checked"
                className="text-sm font-medium cursor-pointer"
              >
                {t("pdf.includeChecked")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("pdf.includeCheckedDescription")}
              </p>
            </div>
          </div>
        </div>

        {/* Export Button */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isGenerating}
          >
            {t("pdf.cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("pdf.generating")}
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {t("pdf.export")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
