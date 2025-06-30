// Macro calculator utility using Mifflin-St Jeor equation

export interface MacroCalculatorInput {
  dateOfBirth: Date;
  gender: string;
  heightCm: number;
  weightKg: number;
  activityLevel: string;
  dietaryGoal: string;
}

export interface MacroTargets {
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

// Calculate age from date of birth
export const calculateAge = (dateOfBirth: Date): number => {
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
};

// Base Metabolic Rate (BMR) Calculation using Mifflin-St Jeor equation
export const calculateBMR = (input: MacroCalculatorInput): number => {
  const age = calculateAge(input.dateOfBirth);
  const { weightKg, heightCm, gender } = input;

  if (gender === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  } else {
    return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
  }
};

// Activity level multipliers
const activityMultipliers: Record<string, number> = {
  sedentary: 1.2, // Little or no exercise
  light: 1.375, // Light exercise 1-3 days/week
  moderate: 1.55, // Moderate exercise 3-5 days/week
  very: 1.725, // Hard exercise 6-7 days/week
  extra: 1.9, // Very hard exercise, physical job
};

// Total Daily Energy Expenditure (TDEE)
export const calculateTDEE = (bmr: number, activityLevel: string): number => {
  const multiplier = activityMultipliers[activityLevel] || 1.2;
  return bmr * multiplier;
};

// Goal-based calorie adjustments
const goalAdjustments: Record<string, number> = {
  lose: 0.85, // 15% deficit for weight loss
  maintain: 1.0, // No adjustment for maintenance
  gain: 1.15, // 15% surplus for weight gain
};

// Adjust calories based on dietary goal
export const adjustForGoal = (tdee: number, goal: string): number => {
  const adjustment = goalAdjustments[goal] || 1.0;
  return Math.round(tdee * adjustment);
};

// Default macro ratios based on goal
const getMacroRatios = (goal: string) => {
  switch (goal) {
    case "lose":
      return { protein: 0.3, carbs: 0.35, fat: 0.35 }; // Higher protein for muscle preservation
    case "gain":
      return { protein: 0.25, carbs: 0.45, fat: 0.3 }; // Higher carbs for energy
    default: // maintain
      return { protein: 0.25, carbs: 0.4, fat: 0.35 }; // Balanced approach
  }
};

// Calculate macro targets in grams
export const calculateMacros = (input: MacroCalculatorInput): MacroTargets => {
  const bmr = calculateBMR(input);
  const tdee = calculateTDEE(bmr, input.activityLevel);
  const dailyCalories = adjustForGoal(tdee, input.dietaryGoal);

  const ratios = getMacroRatios(input.dietaryGoal);

  // Calculate grams (protein and carbs = 4 cal/g, fat = 9 cal/g)
  const proteinGrams = Math.round((dailyCalories * ratios.protein) / 4);
  const carbsGrams = Math.round((dailyCalories * ratios.carbs) / 4);
  const fatGrams = Math.round((dailyCalories * ratios.fat) / 9);

  return {
    dailyCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
};

// Validate macro calculation input
export const validateMacroInput = (
  input: Partial<MacroCalculatorInput>
): string[] => {
  const errors: string[] = [];

  if (!input.dateOfBirth) {
    errors.push("Date of birth is required");
  } else {
    const age = calculateAge(new Date(input.dateOfBirth));
    if (age < 13 || age > 120) {
      errors.push("Age must be between 13 and 120 years");
    }
  }

  if (!input.gender || !["male", "female", "other"].includes(input.gender)) {
    errors.push("Valid gender selection is required");
  }

  if (!input.heightCm || input.heightCm < 100 || input.heightCm > 250) {
    errors.push("Height must be between 100 and 250 cm");
  }

  if (!input.weightKg || input.weightKg < 30 || input.weightKg > 300) {
    errors.push("Weight must be between 30 and 300 kg");
  }

  if (
    !input.activityLevel ||
    !Object.keys(activityMultipliers).includes(input.activityLevel)
  ) {
    errors.push("Valid activity level selection is required");
  }

  if (
    !input.dietaryGoal ||
    !["lose", "maintain", "gain"].includes(input.dietaryGoal)
  ) {
    errors.push("Valid dietary goal selection is required");
  }

  return errors;
};
