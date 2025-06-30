// Types for the onboarding wizard

// Form data types for each step
export interface DemographicsData {
  dateOfBirth: string; // ISO date string
  gender: "male" | "female" | "other";
  heightCm: number;
  weightKg: number;
  activityLevel: "sedentary" | "light" | "moderate" | "very" | "extra";
}

export interface GoalsData {
  dietaryGoal: "lose" | "maintain" | "gain";
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}

export interface PreferencesData {
  dietaryType: string[];
  allergies: string[];
  cuisinePrefs: string[];
}

export interface FamilyMemberData {
  name: string;
  relationship: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  heightCm?: number;
  weightKg?: number;
  dietaryNeeds: string[];
}

// Complete onboarding data
export interface OnboardingData {
  demographics: DemographicsData;
  goals: GoalsData;
  preferences: PreferencesData;
  familyMembers: FamilyMemberData[];
}

// Onboarding state management
export interface OnboardingState {
  currentStep: number;
  demographics: DemographicsData | null;
  goals: GoalsData | null;
  preferences: PreferencesData | null;
  familyMembers: FamilyMemberData[];
  isSubmitting: boolean;
  errors: Record<string, string>;
}

// Constants
export const ACTIVITY_LEVELS = [
  {
    value: "sedentary",
    label: "Sedentary",
    description: "Little or no exercise",
  },
  {
    value: "light",
    label: "Lightly Active",
    description: "Light exercise 1-3 days/week",
  },
  {
    value: "moderate",
    label: "Moderately Active",
    description: "Moderate exercise 3-5 days/week",
  },
  {
    value: "very",
    label: "Very Active",
    description: "Hard exercise 6-7 days/week",
  },
  {
    value: "extra",
    label: "Extra Active",
    description: "Very hard exercise, physical job",
  },
] as const;

export const DIETARY_GOALS = [
  {
    value: "lose",
    label: "Lose Weight",
    description: "Create a caloric deficit",
  },
  {
    value: "maintain",
    label: "Maintain Weight",
    description: "Keep current weight",
  },
  { value: "gain", label: "Gain Weight", description: "Build muscle mass" },
] as const;

export const DIETARY_TYPES = [
  "Vegetarian",
  "Vegan",
  "Keto",
  "Paleo",
  "Mediterranean",
  "Low Carb",
  "Gluten Free",
  "Dairy Free",
  "Pescatarian",
  "Whole30",
] as const;

export const COMMON_ALLERGIES = [
  "Peanuts",
  "Tree Nuts",
  "Milk",
  "Eggs",
  "Wheat",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
] as const;

export const CUISINE_PREFERENCES = [
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Indian",
  "Thai",
  "Mediterranean",
  "American",
  "French",
  "Spanish",
  "Greek",
  "Korean",
] as const;

export const RELATIONSHIP_TYPES = [
  "Spouse",
  "Partner",
  "Child",
  "Parent",
  "Sibling",
  "Roommate",
  "Other",
] as const;
