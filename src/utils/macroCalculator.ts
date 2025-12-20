/**
 * Macro Calculator Utility
 * Calculates daily calorie needs and macronutrient targets based on user demographics and goals
 */

type Gender = "male" | "female" | "other";
type ActivityLevel = "sedentary" | "light" | "moderate" | "very" | "extra";
type DietaryGoal = "lose" | "maintain" | "gain";

interface MacroCalculatorParams {
  dateOfBirth: Date;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  dietaryGoal: string;
}

interface MacroResult {
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Activity level multipliers for TDEE calculation
 * Based on standard Harris-Benedict activity factors
 */
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2, // Little or no exercise
  light: 1.375, // Light exercise 1-3 days/week
  moderate: 1.55, // Moderate exercise 3-5 days/week
  very: 1.725, // Hard exercise 6-7 days/week
  extra: 1.9, // Very hard exercise, physical job
};

/**
 * Calorie adjustments for dietary goals
 */
const GOAL_CALORIE_ADJUSTMENTS: Record<DietaryGoal, number> = {
  lose: -500, // 500 calorie deficit for ~1 lb/week loss
  maintain: 0,
  gain: 300, // 300 calorie surplus for lean gains
};

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 * This is considered the most accurate formula for BMR
 *
 * Male: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) + 5
 * Female: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age) - 161
 */
function calculateBMR(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: Gender
): number {
  const baseCalc = 10 * weightKg + 6.25 * heightCm - 5 * age;

  switch (gender) {
    case "male":
      return baseCalc + 5;
    case "female":
      return baseCalc - 161;
    case "other":
      // Use average of male and female for "other"
      return baseCalc - 78;
    default:
      return baseCalc;
  }
}

/**
 * Calculate daily macronutrient targets based on demographics and goals
 *
 * Uses:
 * - Mifflin-St Jeor equation for BMR
 * - Activity multipliers for TDEE
 * - Goal-based calorie adjustments
 * - Balanced macro split: 30% protein, 40% carbs, 30% fat
 */
export function calculateMacros(params: MacroCalculatorParams): MacroResult {
  const { dateOfBirth, gender, heightCm, weightKg, activityLevel, dietaryGoal } =
    params;

  // Calculate age
  const age = calculateAge(dateOfBirth);

  // Calculate BMR using Mifflin-St Jeor equation
  const bmr = calculateBMR(weightKg, heightCm, age, gender);

  // Calculate TDEE (Total Daily Energy Expenditure)
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  const tdee = bmr * activityMultiplier;

  // Apply goal-based calorie adjustment
  const goalAdjustment =
    GOAL_CALORIE_ADJUSTMENTS[dietaryGoal as DietaryGoal] || 0;
  const dailyCalories = Math.round(tdee + goalAdjustment);

  // Ensure minimum calories for health (never below BMR)
  const adjustedCalories = Math.max(dailyCalories, Math.round(bmr));

  // Calculate macros based on balanced split
  // Protein: 30% of calories (4 cal/g)
  // Carbs: 40% of calories (4 cal/g)
  // Fat: 30% of calories (9 cal/g)
  const proteinGrams = Math.round((adjustedCalories * 0.3) / 4);
  const carbsGrams = Math.round((adjustedCalories * 0.4) / 4);
  const fatGrams = Math.round((adjustedCalories * 0.3) / 9);

  return {
    dailyCalories: adjustedCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}

/**
 * Calculate macros with custom protein target based on body weight
 * Useful for athletes or those who want higher protein intake
 *
 * @param proteinPerKg - Grams of protein per kg of body weight (default 2.0)
 */
export function calculateMacrosWithCustomProtein(
  params: MacroCalculatorParams,
  proteinPerKg: number = 2.0
): MacroResult {
  const { weightKg, dietaryGoal, activityLevel, dateOfBirth, gender, heightCm } =
    params;

  // Get base TDEE calculation
  const age = calculateAge(dateOfBirth);
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.55;
  const tdee = bmr * activityMultiplier;

  // Apply goal-based calorie adjustment
  const goalAdjustment =
    GOAL_CALORIE_ADJUSTMENTS[dietaryGoal as DietaryGoal] || 0;
  const dailyCalories = Math.max(
    Math.round(tdee + goalAdjustment),
    Math.round(bmr)
  );

  // Calculate protein based on body weight
  const proteinGrams = Math.round(weightKg * proteinPerKg);
  const proteinCalories = proteinGrams * 4;

  // Remaining calories split between carbs (55%) and fat (45%)
  const remainingCalories = dailyCalories - proteinCalories;
  const carbsGrams = Math.round((remainingCalories * 0.55) / 4);
  const fatGrams = Math.round((remainingCalories * 0.45) / 9);

  return {
    dailyCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}
