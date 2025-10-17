/**
 * Locale-specific number formatting utilities
 * Formats nutrient values according to user's locale preferences
 *
 * @module lib/localeFormatting
 */

/**
 * Format a nutrient value according to locale
 * Uses Intl.NumberFormat for locale-specific formatting
 *
 * @param value - The numeric value to format
 * @param locale - The locale string (e.g., 'en-US', 'es-ES', 'pl-PL')
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string
 *
 * @example
 * formatNutrientValue(123.456, 'en-US') // "123.5"
 * formatNutrientValue(123.456, 'es-ES') // "123,5"
 * formatNutrientValue(123.456, 'pl-PL') // "123,5"
 */
export function formatNutrientValue(
  value: number,
  locale: string = "en-US",
  decimals: number = 1
): string {
  // Handle invalid values
  if (typeof value !== "number" || isNaN(value)) {
    return "0";
  }

  // Round to specified decimals
  const roundedValue = Number(value.toFixed(decimals));

  // Use Intl.NumberFormat for locale-specific formatting
  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(roundedValue);
}

/**
 * Format a nutrient value with unit
 *
 * @param value - The numeric value to format
 * @param unit - The unit string (e.g., 'g', 'mg', 'kcal')
 * @param locale - The locale string
 * @param decimals - Number of decimal places
 * @returns Formatted number with unit
 *
 * @example
 * formatNutrientWithUnit(25.5, 'g', 'en-US') // "25.5g"
 * formatNutrientWithUnit(25.5, 'g', 'es-ES') // "25,5g"
 */
export function formatNutrientWithUnit(
  value: number,
  unit: string,
  locale: string = "en-US",
  decimals: number = 1
): string {
  const formattedValue = formatNutrientValue(value, locale, decimals);
  return `${formattedValue}${unit}`;
}

/**
 * Format calories without decimals
 *
 * @param value - The calorie value
 * @param locale - The locale string
 * @returns Formatted calorie value
 *
 * @example
 * formatCalories(1234.5, 'en-US') // "1,235"
 * formatCalories(1234.5, 'es-ES') // "1.235"
 * formatCalories(1234.5, 'pl-PL') // "1 235"
 */
export function formatCalories(
  value: number,
  locale: string = "en-US"
): string {
  if (typeof value !== "number" || isNaN(value)) {
    return "0";
  }

  const roundedValue = Math.round(value);

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return formatter.format(roundedValue);
}

/**
 * Format a percentage value
 *
 * @param value - The percentage value (0-100)
 * @param locale - The locale string
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(85.5, 'en-US') // "86%"
 * formatPercentage(85.5, 'es-ES', 1) // "85,5%"
 */
export function formatPercentage(
  value: number,
  locale: string = "en-US",
  decimals: number = 0
): string {
  if (typeof value !== "number" || isNaN(value)) {
    return "0%";
  }

  const roundedValue = Number(value.toFixed(decimals));

  const formatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return `${formatter.format(roundedValue)}%`;
}

/**
 * Get locale from language code
 * Maps simple language codes to full locale strings
 *
 * @param language - Language code ('en', 'es', 'pl')
 * @returns Full locale string
 */
export function getLocaleFromLanguage(language: string): string {
  const localeMap: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    pl: "pl-PL",
  };

  return localeMap[language] ?? "en-US";
}

/**
 * Parse a locale-formatted number string back to number
 * Handles both comma and period as decimal separator
 *
 * @param value - The formatted number string
 * @returns Parsed number
 *
 * @example
 * parseLocaleNumber("123.5") // 123.5
 * parseLocaleNumber("123,5") // 123.5
 * parseLocaleNumber("1 234,5") // 1234.5
 */
export function parseLocaleNumber(value: string): number {
  if (!value || typeof value !== "string") {
    return 0;
  }

  // Remove all spaces and convert comma to period
  const normalized = value.replace(/\s/g, "").replace(/,/g, ".");

  const parsed = parseFloat(normalized);

  return isNaN(parsed) ? 0 : parsed;
}
