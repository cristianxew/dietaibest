/**
 * Shopping List PDF Generator
 * Generates a PDF document from shopping list data using jsPDF
 *
 * @module lib/pdf/shopping-list-pdf
 */

import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import type { Locale } from "date-fns";
import { enUS, es, pl } from "date-fns/locale";
import type {
  PDFExportOptions,
  PDFTranslations,
  PDFGenerationInput,
} from "@/types/pdf";
import type {
  ShoppingListIngredient,
  ShoppingListRecipe,
  IngredientCategory,
} from "@/types/shopping-list";
import {
  PDF_PAGE,
  PDF_COLORS,
  PDF_FONTS,
  PDF_SPACING,
  colorToArray,
  getCategoryColors,
} from "./pdf-styles";

// ============================================================================
// Locale Mapping
// ============================================================================

const DATE_LOCALES: Record<string, Locale> = {
  en: enUS,
  es: es,
  pl: pl,
};

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Generate and download a shopping list PDF
 */
export async function generateShoppingListPDF(
  input: PDFGenerationInput,
  options: PDFExportOptions,
  translations: PDFTranslations
): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Track current Y position
  let yPos: number = PDF_PAGE.margin;

  // Render header
  yPos = renderHeader(doc, input, translations, yPos);

  // Render content based on view mode
  if (options.viewMode === "category") {
    yPos = renderCategoryView(doc, input, options, translations, yPos);
  } else {
    yPos = renderRecipeView(doc, input, options, translations, yPos);
  }

  // Add page numbers to all pages
  addPageNumbers(doc, translations);

  // Generate filename and download
  const dateStr = format(new Date(), "yyyy-MM-dd");
  const filename = `shopping-list-${dateStr}.pdf`;
  doc.save(filename);
}

// ============================================================================
// Header Section
// ============================================================================

function renderHeader(
  doc: jsPDF,
  input: PDFGenerationInput,
  translations: PDFTranslations,
  yPos: number
): number {
  const { dateRange, metadata, locale } = input;
  const dateLocale = DATE_LOCALES[locale] || enUS;

  // Title
  doc.setFontSize(PDF_FONTS.title);
  doc.setTextColor(...colorToArray(PDF_COLORS.text));
  doc.setFont("helvetica", "bold");
  doc.text(translations.title, PDF_PAGE.margin, yPos);
  yPos += 8;

  // Date range
  const startDate = format(parseISO(dateRange.startDate), "MMM d, yyyy", {
    locale: dateLocale,
  });
  const endDate = format(parseISO(dateRange.endDate), "MMM d, yyyy", {
    locale: dateLocale,
  });

  doc.setFontSize(PDF_FONTS.subtitle);
  doc.setTextColor(...colorToArray(PDF_COLORS.textMuted));
  doc.setFont("helvetica", "normal");
  doc.text(`${startDate} - ${endDate}`, PDF_PAGE.margin, yPos);
  yPos += 5;

  // Stats
  const recipesCount = metadata.totalRecipes;
  const itemsCount = input.ingredients.length;
  const statsText = `${recipesCount} ${translations.recipes} | ${itemsCount} ${translations.items}`;
  doc.text(statsText, PDF_PAGE.margin, yPos);
  yPos += PDF_SPACING.sectionGap;

  // Divider line
  doc.setDrawColor(...colorToArray(PDF_COLORS.border));
  doc.setLineWidth(0.3);
  doc.line(
    PDF_PAGE.margin,
    yPos,
    PDF_PAGE.width - PDF_PAGE.margin,
    yPos
  );
  yPos += PDF_SPACING.sectionGap;

  return yPos;
}

// ============================================================================
// Category View
// ============================================================================

function renderCategoryView(
  doc: jsPDF,
  input: PDFGenerationInput,
  options: PDFExportOptions,
  translations: PDFTranslations,
  yPos: number
): number {
  const { ingredients, purchasedAmounts } = input;

  // Filter ingredients based on options
  const filteredIngredients = filterIngredients(
    ingredients,
    purchasedAmounts,
    options.includeCheckedItems
  );

  // Group by category
  const categories = groupByCategory(filteredIngredients);

  // Render each category
  const categoryOrder: IngredientCategory[] = [
    "fruits",
    "vegetables",
    "proteins",
    "dairy",
    "grains",
    "pantry",
    "other",
  ];

  for (const category of categoryOrder) {
    const items = categories.get(category);
    if (!items || items.length === 0) continue;

    // Check if we need a new page
    const estimatedHeight = 10 + items.length * 6;
    if (yPos + estimatedHeight > PDF_PAGE.height - PDF_PAGE.margin - PDF_SPACING.footerHeight) {
      doc.addPage();
      yPos = PDF_PAGE.margin;
    }

    // Render category header
    yPos = renderCategoryHeader(doc, category, items.length, translations, yPos);

    // Render items
    for (const item of items) {
      // Check for page break
      if (yPos + 6 > PDF_PAGE.height - PDF_PAGE.margin - PDF_SPACING.footerHeight) {
        doc.addPage();
        yPos = PDF_PAGE.margin;
      }

      const isChecked = isItemFullyPurchased(item, purchasedAmounts);
      const purchasedAmount = purchasedAmounts[item.id] || 0;
      yPos = renderIngredientItem(doc, item, isChecked, purchasedAmount, yPos);
    }

    yPos += PDF_SPACING.categoryGap;
  }

  return yPos;
}

function renderCategoryHeader(
  doc: jsPDF,
  category: IngredientCategory,
  itemCount: number,
  translations: PDFTranslations,
  yPos: number
): number {
  const colors = getCategoryColors(category);
  const categoryName = translations.categories[category] || category;

  // Category badge background
  const badgeWidth = doc.getTextWidth(categoryName) + 8;
  doc.setFillColor(...colorToArray(colors.background));
  doc.roundedRect(PDF_PAGE.margin, yPos - 4, badgeWidth, 6, 1, 1, "F");

  // Category name
  doc.setFontSize(PDF_FONTS.body);
  doc.setTextColor(...colorToArray(colors.text));
  doc.setFont("helvetica", "bold");
  doc.text(categoryName, PDF_PAGE.margin + 4, yPos);

  // Item count
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...colorToArray(PDF_COLORS.textMuted));
  doc.text(
    `(${itemCount})`,
    PDF_PAGE.margin + badgeWidth + 2,
    yPos
  );

  yPos += 6;
  return yPos;
}

function renderIngredientItem(
  doc: jsPDF,
  item: ShoppingListIngredient,
  isChecked: boolean,
  purchasedAmount: number,
  yPos: number
): number {
  const checkboxX = PDF_PAGE.margin + PDF_SPACING.indent;
  const textX = checkboxX + PDF_SPACING.checkboxSize + PDF_SPACING.checkboxGap;

  // Checkbox
  doc.setDrawColor(...colorToArray(PDF_COLORS.border));
  doc.setLineWidth(0.3);
  doc.rect(
    checkboxX,
    yPos - 3,
    PDF_SPACING.checkboxSize,
    PDF_SPACING.checkboxSize
  );

  if (isChecked) {
    // Draw checkmark
    doc.setDrawColor(...colorToArray(PDF_COLORS.brand));
    doc.setLineWidth(0.5);
    doc.line(checkboxX + 0.8, yPos - 1, checkboxX + 1.6, yPos);
    doc.line(checkboxX + 1.6, yPos, checkboxX + 3.2, yPos - 2.2);
  }

  // Ingredient name
  doc.setFontSize(PDF_FONTS.body);
  if (isChecked) {
    doc.setTextColor(...colorToArray(PDF_COLORS.textLight));
  } else {
    doc.setTextColor(...colorToArray(PDF_COLORS.text));
  }
  doc.setFont("helvetica", "normal");

  // Capitalize first letter
  const displayName = item.name.charAt(0).toUpperCase() + item.name.slice(1);
  doc.text(displayName, textX, yPos);

  // Calculate remaining amount (total - purchased)
  const remainingAmount = Math.max(0, item.baseAmount - purchasedAmount);
  const amountText = formatAmount(remainingAmount, item.unit);
  const amountWidth = doc.getTextWidth(amountText);
  doc.setTextColor(...colorToArray(PDF_COLORS.textMuted));
  doc.text(
    amountText,
    PDF_PAGE.width - PDF_PAGE.margin - amountWidth,
    yPos
  );

  // Strikethrough for checked items
  if (isChecked) {
    const nameWidth = doc.getTextWidth(displayName);
    doc.setDrawColor(...colorToArray(PDF_COLORS.textLight));
    doc.setLineWidth(0.2);
    doc.line(textX, yPos - 1, textX + nameWidth, yPos - 1);
  }

  yPos += PDF_SPACING.itemGap + 3;
  return yPos;
}

// ============================================================================
// Recipe View
// ============================================================================

function renderRecipeView(
  doc: jsPDF,
  input: PDFGenerationInput,
  options: PDFExportOptions,
  translations: PDFTranslations,
  yPos: number
): number {
  const { recipes, purchasedAmounts, ingredients } = input;

  // Build a map of ingredient IDs to check status
  const ingredientStatusMap = new Map<string, boolean>();
  for (const ing of ingredients) {
    ingredientStatusMap.set(ing.id, isItemFullyPurchased(ing, purchasedAmounts));
  }

  for (const recipe of recipes) {
    // Filter recipe ingredients if not including checked items
    const recipeIngredients = options.includeCheckedItems
      ? recipe.ingredients
      : recipe.ingredients.filter((ing) => {
          // Create the same ID format used in category view
          const normalizedName = ing.name.toLowerCase().trim();
          const normalizedUnit = ing.unit.toLowerCase().trim();
          const ingredientId = `${normalizedName}_${normalizedUnit}`;
          return !ingredientStatusMap.get(ingredientId);
        });

    // Skip recipe if all ingredients are checked and we're excluding them
    if (!options.includeCheckedItems && recipeIngredients.length === 0) {
      continue;
    }

    // Check if we need a new page
    const estimatedHeight = 15 + recipeIngredients.length * 5;
    if (yPos + estimatedHeight > PDF_PAGE.height - PDF_PAGE.margin - PDF_SPACING.footerHeight) {
      doc.addPage();
      yPos = PDF_PAGE.margin;
    }

    // Recipe header
    yPos = renderRecipeHeader(doc, recipe, translations, yPos);

    // Recipe ingredients
    for (const ing of recipeIngredients) {
      if (yPos + 5 > PDF_PAGE.height - PDF_PAGE.margin - PDF_SPACING.footerHeight) {
        doc.addPage();
        yPos = PDF_PAGE.margin;
      }

      // Check if this ingredient is fully purchased
      const normalizedName = ing.name.toLowerCase().trim();
      const normalizedUnit = ing.unit.toLowerCase().trim();
      const ingredientId = `${normalizedName}_${normalizedUnit}`;
      const isChecked = ingredientStatusMap.get(ingredientId) || false;

      yPos = renderRecipeIngredient(doc, ing, isChecked, yPos);
    }

    yPos += PDF_SPACING.sectionGap;
  }

  return yPos;
}

function renderRecipeHeader(
  doc: jsPDF,
  recipe: ShoppingListRecipe,
  translations: PDFTranslations,
  yPos: number
): number {
  // Recipe title
  doc.setFontSize(PDF_FONTS.heading);
  doc.setTextColor(...colorToArray(PDF_COLORS.text));
  doc.setFont("helvetica", "bold");
  doc.text(recipe.title, PDF_PAGE.margin, yPos);
  yPos += 5;

  // Servings
  doc.setFontSize(PDF_FONTS.small);
  doc.setTextColor(...colorToArray(PDF_COLORS.textMuted));
  doc.setFont("helvetica", "normal");
  doc.text(
    `${recipe.scheduledServings} ${translations.servings}`,
    PDF_PAGE.margin,
    yPos
  );
  yPos += 5;

  return yPos;
}

function renderRecipeIngredient(
  doc: jsPDF,
  ing: { name: string; amount: number; unit: string },
  isChecked: boolean,
  yPos: number
): number {
  const checkboxX = PDF_PAGE.margin + PDF_SPACING.indent;
  const textX = checkboxX + PDF_SPACING.checkboxSize + PDF_SPACING.checkboxGap;

  // Checkbox
  doc.setDrawColor(...colorToArray(PDF_COLORS.border));
  doc.setLineWidth(0.3);
  doc.rect(
    checkboxX,
    yPos - 3,
    PDF_SPACING.checkboxSize,
    PDF_SPACING.checkboxSize
  );

  if (isChecked) {
    doc.setDrawColor(...colorToArray(PDF_COLORS.brand));
    doc.setLineWidth(0.5);
    doc.line(checkboxX + 0.8, yPos - 1, checkboxX + 1.6, yPos);
    doc.line(checkboxX + 1.6, yPos, checkboxX + 3.2, yPos - 2.2);
  }

  // Ingredient name
  doc.setFontSize(PDF_FONTS.small);
  if (isChecked) {
    doc.setTextColor(...colorToArray(PDF_COLORS.textLight));
  } else {
    doc.setTextColor(...colorToArray(PDF_COLORS.text));
  }
  doc.setFont("helvetica", "normal");

  const displayName = ing.name.charAt(0).toUpperCase() + ing.name.slice(1);
  doc.text(displayName, textX, yPos);

  // Amount (right-aligned)
  const amountText = formatAmount(ing.amount, ing.unit);
  const amountWidth = doc.getTextWidth(amountText);
  doc.setTextColor(...colorToArray(PDF_COLORS.textMuted));
  doc.text(
    amountText,
    PDF_PAGE.width - PDF_PAGE.margin - amountWidth,
    yPos
  );

  // Strikethrough for checked items
  if (isChecked) {
    const nameWidth = doc.getTextWidth(displayName);
    doc.setDrawColor(...colorToArray(PDF_COLORS.textLight));
    doc.setLineWidth(0.2);
    doc.line(textX, yPos - 1, textX + nameWidth, yPos - 1);
  }

  yPos += PDF_SPACING.itemGap + 2;
  return yPos;
}

// ============================================================================
// Footer / Page Numbers
// ============================================================================

function addPageNumbers(doc: jsPDF, translations: PDFTranslations): void {
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // Page number
    doc.setFontSize(PDF_FONTS.tiny);
    doc.setTextColor(...colorToArray(PDF_COLORS.textMuted));
    doc.setFont("helvetica", "normal");

    const pageText = `${translations.page} ${i} ${translations.of} ${pageCount}`;
    const pageWidth = doc.getTextWidth(pageText);
    doc.text(
      pageText,
      PDF_PAGE.width - PDF_PAGE.margin - pageWidth,
      PDF_PAGE.height - 8
    );

    // Generated by text
    doc.text(
      translations.generatedBy,
      PDF_PAGE.margin,
      PDF_PAGE.height - 8
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function filterIngredients(
  ingredients: ShoppingListIngredient[],
  purchasedAmounts: Record<string, number>,
  includeChecked: boolean
): ShoppingListIngredient[] {
  if (includeChecked) return ingredients;

  return ingredients.filter((ing) => {
    const purchased = purchasedAmounts[ing.id] || 0;
    return purchased < ing.baseAmount;
  });
}

function groupByCategory(
  ingredients: ShoppingListIngredient[]
): Map<IngredientCategory, ShoppingListIngredient[]> {
  const groups = new Map<IngredientCategory, ShoppingListIngredient[]>();

  for (const ing of ingredients) {
    const category = ing.category;
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(ing);
  }

  return groups;
}

function isItemFullyPurchased(
  item: ShoppingListIngredient,
  purchasedAmounts: Record<string, number>
): boolean {
  const purchased = purchasedAmounts[item.id] || 0;
  return purchased >= item.baseAmount;
}

function formatAmount(amount: number, unit: string): string {
  // Format number nicely
  let formattedAmount: string;
  if (amount === Math.floor(amount)) {
    formattedAmount = amount.toString();
  } else if (amount < 1) {
    formattedAmount = amount.toFixed(2).replace(/\.?0+$/, "");
  } else {
    formattedAmount = amount.toFixed(1).replace(/\.0$/, "");
  }

  // Handle unit display
  if (!unit || unit === "unit" || unit === "units") {
    return formattedAmount;
  }

  return `${formattedAmount} ${unit}`;
}
