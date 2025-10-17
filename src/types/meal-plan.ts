import { z } from "zod";

// ============================================================================
// Meal Type Enum
// ============================================================================

export const mealTypeEnum = z.enum([
  "breakfast",
  "lunch",
  "dinner",
  "snack",
]);
export type MealType = z.infer<typeof mealTypeEnum>;

export const MEAL_TYPES: MealType[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

// ============================================================================
// Meal Plan Schemas
// ============================================================================

// Meal Plan form schema for creation/editing
export const mealPlanFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  startDate: z.date({ required_error: "Start date is required" }),
  endDate: z.date({ required_error: "End date is required" }),
  targetCalories: z.number().min(0).optional(),
  targetProtein: z.number().min(0).optional(),
  targetCarbs: z.number().min(0).optional(),
  targetFat: z.number().min(0).optional(),
  isActive: z.boolean().default(false),
  isPublic: z.boolean().default(false),
}).refine((data) => data.endDate >= data.startDate, {
  message: "End date must be after or equal to start date",
  path: ["endDate"],
});

export type MealPlanFormData = z.infer<typeof mealPlanFormSchema>;

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

// Meal plan filter schema
export const mealPlanFilterSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  startDateFrom: z.date().optional(),
  startDateTo: z.date().optional(),
  sortBy: z.enum(["createdAt", "startDate", "name"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(12),
});

export type MealPlanFilter = z.infer<typeof mealPlanFilterSchema>;

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
  date: Date;
  dayOfWeek: number;
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
  date: Date;
  dayOfWeek: number;
  meals: MealDisplay[];
  macros: MacroSummary;
}

export interface MealPlanDisplay {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  isPublic: boolean;
  shareToken?: string;
  targets?: MacroTarget;
  days: DayDisplay[];
  weeklyMacros: WeeklyMacros;
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
