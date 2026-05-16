import { z } from "zod";

// ============================================================================
// Meal Type Enum
// ============================================================================

export const mealTypeEnum = z.enum([
  "breakfast",
  "morningSnack",
  "lunch",
  "afternoonSnack",
  "dinner",
  "eveningSnack",
  "snack",
]);
export type MealType = z.infer<typeof mealTypeEnum>;

export const MEAL_TYPES: MealType[] = [
  "breakfast",
  "morningSnack",
  "lunch",
  "afternoonSnack",
  "dinner",
  "eveningSnack",
  "snack",
];

// ============================================================================
// Meal Slot Presets (2-6 meals per day)
// ============================================================================

export interface MealSlotPreset {
  count: number;
  label: string; // Translation key
  slots: MealType[];
}

export const MEAL_SLOT_PRESETS: MealSlotPreset[] = [
  {
    count: 2,
    label: "mealPlans.mealCount.2",
    slots: ["lunch", "dinner"],
  },
  {
    count: 3,
    label: "mealPlans.mealCount.3",
    slots: ["breakfast", "lunch", "dinner"],
  },
  {
    count: 4,
    label: "mealPlans.mealCount.4",
    slots: ["breakfast", "lunch", "dinner", "snack"],
  },
  {
    count: 5,
    label: "mealPlans.mealCount.5",
    slots: ["breakfast", "morningSnack", "lunch", "afternoonSnack", "dinner"],
  },
  {
    count: 6,
    label: "mealPlans.mealCount.6",
    slots: [
      "breakfast",
      "morningSnack",
      "lunch",
      "afternoonSnack",
      "dinner",
      "eveningSnack",
    ],
  },
];

// ============================================================================
// Meal Plan Template Schemas
// ============================================================================

// Meal item within a day when creating a plan with pre-populated meals
// (used by the AI generator — allows nullable recipeId for failed slots)
export const mealPlanMealItemSchema = z.object({
  recipeId: z.string().uuid().nullable(),
  mealType: mealTypeEnum,
  servings: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).optional(),
  /** Set to true when the AI failed to generate a recipe for this slot */
  generationFailed: z.boolean().optional(),
  /** Human-readable reason the slot generation failed */
  generationError: z.string().optional(),
});

export type MealPlanMealItemData = z.infer<typeof mealPlanMealItemSchema>;

// Meal Plan Template form schema for creation/editing
export const mealPlanTemplateFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  duration: z
    .number()
    .int()
    .min(1)
    .max(365, "Duration must be between 1 and 365 days"),
  mealSlots: z
    .array(mealTypeEnum)
    .min(2)
    .max(6)
    .default(["breakfast", "lunch", "dinner"]),
  templateId: z.string().uuid().optional(), // Optional: create from existing template
  targetCalories: z.number().min(0).optional(),
  targetProtein: z.number().min(0).optional(),
  targetCarbs: z.number().min(0).optional(),
  targetFat: z.number().min(0).optional(),
  isPublic: z.boolean().default(false),
  /**
   * Optional pre-populated days with meals (used by AI generator).
   * When provided, days[i].meals are created instead of copying from templateId.
   * Existing UI callers omit this field — behavior unchanged for them.
   */
  days: z
    .array(
      z.object({
        dayNumber: z.number().int().min(1),
        meals: z.array(mealPlanMealItemSchema).optional(),
      })
    )
    .optional(),
});

export type MealPlanTemplateFormData = z.infer<
  typeof mealPlanTemplateFormSchema
>;
export type MealPlanTemplateFormInput = z.input<
  typeof mealPlanTemplateFormSchema
>;

// Schema for scheduling a template to the calendar
export const scheduleMealPlanSchema = z.object({
  templateId: z.string().uuid("Invalid template ID"),
  startDate: z.date({ required_error: "Start date is required" }),
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
});

export type ScheduleMealPlanData = z.infer<typeof scheduleMealPlanSchema>;

// Legacy alias for backwards compatibility
export const mealPlanFormSchema = mealPlanTemplateFormSchema;
export type MealPlanFormData = MealPlanTemplateFormData;

// Schema for adding a meal to a plan
export const addMealSchema = z.object({
  mealPlanDayId: z.string().uuid("Invalid meal plan day ID"),
  recipeId: z.string().uuid("Invalid recipe ID"),
  mealType: mealTypeEnum,
  servings: z.number().int().min(1).default(1),
});

export type AddMealData = z.infer<typeof addMealSchema>;

// Schema for moving a meal (drag-and-drop)
export const moveMealSchema = z.object({
  mealId: z.string().uuid("Invalid meal ID"),
  targetDayId: z.string().uuid("Invalid target day ID"),
  targetMealType: mealTypeEnum,
});

export type MoveMealData = z.infer<typeof moveMealSchema>;

// Schema for updating meal servings
export const updateMealServingsSchema = z.object({
  mealId: z.string().uuid("Invalid meal ID"),
  servings: z.number().int().min(1),
});

export type UpdateMealServingsData = z.infer<typeof updateMealServingsSchema>;

// Meal plan template filter schema
export const mealPlanTemplateFilterSchema = z.object({
  search: z.string().optional(),
  duration: z.number().int().optional(), // Filter by specific duration
  isPublic: z.boolean().optional(),
  sortBy: z.enum(["createdAt", "name", "duration"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(12),
});

export type MealPlanTemplateFilter = z.infer<
  typeof mealPlanTemplateFilterSchema
>;

// Meal plan schedule filter schema
export const mealPlanScheduleFilterSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
  startDateFrom: z.date().optional(),
  startDateTo: z.date().optional(),
  sortBy: z.enum(["createdAt", "startDate"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(12),
});

export type MealPlanScheduleFilter = z.infer<
  typeof mealPlanScheduleFilterSchema
>;

// Legacy alias
export const mealPlanFilterSchema = mealPlanTemplateFilterSchema;
export type MealPlanFilter = MealPlanTemplateFilter;

// ============================================================================
// Macro Calculation Types
// ============================================================================

export interface MacroSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayMacros extends MacroSummary {
  dayNumber: number; // Relative day number in template (1, 2, 3, ...)
  date?: Date; // Optional: calculated date for schedules
}

export interface WeeklyMacros {
  totalMacros: MacroSummary;
  averageDailyMacros: MacroSummary;
  days: DayMacros[];
}

export interface MacroTarget {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

export interface MacroComparison {
  actual: number;
  target?: number;
  percentage?: number; // percentage of target (100 = on target)
  status: "under" | "on-track" | "over"; // visual indicator
}

export interface MacroComparisons {
  calories: MacroComparison;
  protein: MacroComparison;
  carbs: MacroComparison;
  fat: MacroComparison;
}

// ============================================================================
// Display Types (for UI components)
// ============================================================================

export interface MealDisplay {
  id: string;
  recipeId: string;
  recipeName: string;
  recipeImage?: string;
  mealType: MealType;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayDisplay {
  id: string;
  dayNumber: number; // Relative day number (1, 2, 3, ...)
  date?: Date; // Optional: calculated date for schedules
  meals: MealDisplay[];
  macros: MacroSummary;
}

// Template display (no dates, just structure)
export interface MealPlanTemplateDisplay {
  id: string;
  name: string;
  duration: number; // Days
  mealSlots: MealType[]; // Which meals to display per day
  isPublic: boolean;
  shareToken?: string;
  targets?: MacroTarget;
  days: DayDisplay[];
  averageMacros: MacroSummary; // Average macros per day
}

// Schedule display (template + dates)
export interface MealPlanScheduleDisplay {
  id: string;
  templateId: string;
  templateName: string;
  startDate: Date;
  endDate: Date; // Calculated from startDate + template.duration
  status: "active" | "completed" | "cancelled";
  template: MealPlanTemplateDisplay;
}

// Legacy alias for backwards compatibility
export interface MealPlanDisplay extends MealPlanTemplateDisplay {
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

// ============================================================================
// Undo/Redo Types
// ============================================================================

export interface MealOperation {
  type: "add" | "remove" | "move" | "update-servings";
  timestamp: Date;
  data: {
    mealId?: string;
    recipeId?: string;
    dayId?: string;
    mealType?: MealType;
    servings?: number;
    previousDayId?: string;
    previousMealType?: MealType;
    previousServings?: number;
  };
}

export interface UndoStack {
  operations: MealOperation[];
  maxSize: number;
}
