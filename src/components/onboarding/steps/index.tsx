// Onboarding wizard step components
export { DemographicsStep } from "./DemographicsStep";
export { GoalsStep } from "./GoalsStep";
export { PreferencesStep } from "./PreferencesStep";

// Step configuration
export const ONBOARDING_STEPS = [
  {
    id: "demographics",
    title: "Personal Information",
    description: "Tell us about yourself to personalize your experience",
  },
  {
    id: "goals",
    title: "Goals & Nutrition",
    description: "Set your dietary goals and calculate your macro targets",
  },
  {
    id: "preferences",
    title: "Preferences & Family",
    description: "Add dietary preferences and family members",
  },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
