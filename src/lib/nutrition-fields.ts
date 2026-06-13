/**
 * Single source of truth for the recipe micronutrient fields.
 *
 * Shared between the recipe creator modal (Step2 nutrition inputs) and the
 * recipe detail page (full-nutrition accordion) so the two never drift. Each
 * key matches a nullable `Float` column on the Prisma `Recipe` model and a
 * field on `recipeFormSchema`.
 */
export interface NutritionField {
  key: string;
  label: string;
  unit: string;
}

export interface NutritionGroup {
  /** Stable id for i18n lookups (e.g. `microGroup.vitamins`). */
  id: "vitamins" | "minerals" | "other";
  /** English fallback title (matches the modal). */
  title: string;
  fields: NutritionField[];
}

export const MICRONUTRIENT_GROUPS: NutritionGroup[] = [
  {
    id: "vitamins",
    title: "Vitamins",
    fields: [
      { key: "vitaminA", label: "Vitamin A", unit: "µg" },
      { key: "vitaminC", label: "Vitamin C", unit: "mg" },
      { key: "vitaminD", label: "Vitamin D", unit: "µg" },
      { key: "vitaminE", label: "Vitamin E", unit: "mg" },
      { key: "vitaminK", label: "Vitamin K", unit: "µg" },
      { key: "vitaminB12", label: "Vitamin B12", unit: "µg" },
      { key: "folate", label: "Folate", unit: "µg" },
    ],
  },
  {
    id: "minerals",
    title: "Minerals",
    fields: [
      { key: "iron", label: "Iron", unit: "mg" },
      { key: "calcium", label: "Calcium", unit: "mg" },
      { key: "magnesium", label: "Magnesium", unit: "mg" },
      { key: "potassium", label: "Potassium", unit: "mg" },
      { key: "zinc", label: "Zinc", unit: "mg" },
      { key: "sodium", label: "Sodium", unit: "mg" },
    ],
  },
  {
    id: "other",
    title: "Other",
    fields: [
      { key: "sugar", label: "Sugar", unit: "g" },
      { key: "cholesterol", label: "Cholesterol", unit: "mg" },
      { key: "saturatedFat", label: "Saturated Fat", unit: "g" },
      { key: "transFat", label: "Trans Fat", unit: "g" },
    ],
  },
];

/** Flat list of every micronutrient key. */
export const MICRONUTRIENT_KEYS: string[] = MICRONUTRIENT_GROUPS.flatMap((g) =>
  g.fields.map((f) => f.key)
);
