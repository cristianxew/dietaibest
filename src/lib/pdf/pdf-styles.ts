/**
 * PDF Styles
 * Design system constants adapted for jsPDF
 *
 * @module lib/pdf/pdf-styles
 */

// ============================================================================
// Page Settings (A4)
// ============================================================================

export const PDF_PAGE = {
  width: 210, // A4 width in mm
  height: 297, // A4 height in mm
  margin: 15, // Margin in mm
  contentWidth: 180, // 210 - (15 * 2)
} as const;

// ============================================================================
// Colors (RGB format for jsPDF)
// ============================================================================

export const PDF_COLORS = {
  // Brand colors
  brand: { r: 224, g: 122, b: 95 }, // #E07A5F - brand-500

  // Text colors
  text: { r: 28, g: 26, b: 23 }, // #1C1A17 - stone-900
  textMuted: { r: 122, g: 115, b: 103 }, // #7A7367 - stone-500
  textLight: { r: 168, g: 162, b: 152 }, // #A8A298 - stone-400

  // Background colors
  background: { r: 255, g: 255, b: 255 }, // white
  backgroundMuted: { r: 250, g: 248, b: 245 }, // #FAF8F5 - stone-50

  // Border colors
  border: { r: 232, g: 228, b: 221 }, // #E8E4DD - stone-200

  // Category colors (background tints)
  categories: {
    fruits: { r: 254, g: 242, b: 242 }, // rose-50
    vegetables: { r: 240, g: 253, b: 244 }, // green-50
    proteins: { r: 255, g: 247, b: 237 }, // orange-50
    dairy: { r: 239, g: 246, b: 255 }, // blue-50
    grains: { r: 255, g: 251, b: 235 }, // amber-50
    pantry: { r: 250, g: 245, b: 255 }, // violet-50
    other: { r: 249, g: 250, b: 251 }, // gray-50
  },

  // Category text colors
  categoryText: {
    fruits: { r: 190, g: 18, b: 60 }, // rose-700
    vegetables: { r: 21, g: 128, b: 61 }, // green-700
    proteins: { r: 194, g: 65, b: 12 }, // orange-700
    dairy: { r: 29, g: 78, b: 216 }, // blue-700
    grains: { r: 180, g: 83, b: 9 }, // amber-700
    pantry: { r: 109, g: 40, b: 217 }, // violet-700
    other: { r: 55, g: 65, b: 81 }, // gray-700
  },
} as const;

// ============================================================================
// Typography
// ============================================================================

export const PDF_FONTS = {
  // Font sizes in points
  title: 18,
  subtitle: 11,
  heading: 13,
  body: 10,
  small: 9,
  tiny: 8,

  // Line heights (multiplier)
  lineHeight: 1.4,
} as const;

// ============================================================================
// Spacing
// ============================================================================

export const PDF_SPACING = {
  // Vertical spacing in mm
  headerHeight: 25,
  sectionGap: 8,
  itemGap: 3,
  categoryGap: 6,
  footerHeight: 10,

  // Horizontal spacing
  indent: 5,
  checkboxSize: 4,
  checkboxGap: 3,
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert RGB color object to array for jsPDF
 */
export function colorToArray(
  color: { r: number; g: number; b: number }
): [number, number, number] {
  return [color.r, color.g, color.b];
}

/**
 * Get category colors
 */
export function getCategoryColors(category: string): {
  background: { r: number; g: number; b: number };
  text: { r: number; g: number; b: number };
} {
  const key = category as keyof typeof PDF_COLORS.categories;
  return {
    background: PDF_COLORS.categories[key] || PDF_COLORS.categories.other,
    text: PDF_COLORS.categoryText[key] || PDF_COLORS.categoryText.other,
  };
}
