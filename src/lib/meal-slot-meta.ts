import type { MealType } from "@/types/meal-plan";

export interface MealSlotMeta {
  /** lucide-react icon name used by the shared Icon wrapper */
  iconName: string;
  /** Tailwind text color class for the slot accent */
  colorClass: string;
  /** next-intl key under the mealPlans namespace */
  i18nKey: string;
}

export const MEAL_SLOT_META: Record<MealType, MealSlotMeta> = {
  breakfast:      { iconName: "Sunrise",  colorClass: "text-brand-500", i18nKey: "mealTypes.breakfast" },
  morningSnack:   { iconName: "Apple",    colorClass: "text-gold-500",  i18nKey: "mealTypes.morningSnack" },
  lunch:          { iconName: "Sun",      colorClass: "text-sage-500",  i18nKey: "mealTypes.lunch" },
  afternoonSnack: { iconName: "Cookie",   colorClass: "text-gold-500",  i18nKey: "mealTypes.afternoonSnack" },
  dinner:         { iconName: "Moon",     colorClass: "text-brand-400", i18nKey: "mealTypes.dinner" },
  eveningSnack:   { iconName: "Cookie",   colorClass: "text-gold-600",  i18nKey: "mealTypes.eveningSnack" },
  snack:          { iconName: "Apple",    colorClass: "text-gold-500",  i18nKey: "mealTypes.snack" },
};
