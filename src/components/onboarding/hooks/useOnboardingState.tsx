"use client";

import {
  createContext,
  useContext,
  useCallback,
  useReducer,
  useEffect,
  ReactNode,
} from "react";
import type {
  OnboardingState,
  DemographicsData,
  GoalsData,
  PreferencesData,
  FamilyMemberData,
} from "@/types/onboarding";

// Action types
type OnboardingAction =
  | { type: "SET_STEP"; payload: number }
  | { type: "SET_DEMOGRAPHICS"; payload: DemographicsData }
  | { type: "SET_GOALS"; payload: GoalsData }
  | { type: "SET_PREFERENCES"; payload: PreferencesData }
  | { type: "ADD_FAMILY_MEMBER"; payload: FamilyMemberData }
  | {
      type: "UPDATE_FAMILY_MEMBER";
      payload: { index: number; data: FamilyMemberData };
    }
  | { type: "REMOVE_FAMILY_MEMBER"; payload: number }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "SET_ERROR"; payload: { field: string; message: string } }
  | { type: "CLEAR_ERRORS" }
  | { type: "RESET" }
  | { type: "RESTORE_STATE"; payload: OnboardingState };

// Initial state
const initialState: OnboardingState = {
  currentStep: 0,
  demographics: null,
  goals: null,
  preferences: null,
  familyMembers: [],
  isSubmitting: false,
  errors: {},
};

// Reducer
function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction
): OnboardingState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.payload };
    case "SET_DEMOGRAPHICS":
      return { ...state, demographics: action.payload };
    case "SET_GOALS":
      return { ...state, goals: action.payload };
    case "SET_PREFERENCES":
      return { ...state, preferences: action.payload };
    case "ADD_FAMILY_MEMBER":
      return {
        ...state,
        familyMembers: [...state.familyMembers, action.payload],
      };
    case "UPDATE_FAMILY_MEMBER":
      return {
        ...state,
        familyMembers: state.familyMembers.map((member, index) =>
          index === action.payload.index ? action.payload.data : member
        ),
      };
    case "REMOVE_FAMILY_MEMBER":
      return {
        ...state,
        familyMembers: state.familyMembers.filter(
          (_, index) => index !== action.payload
        ),
      };
    case "SET_SUBMITTING":
      return { ...state, isSubmitting: action.payload };
    case "SET_ERROR":
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.message,
        },
      };
    case "CLEAR_ERRORS":
      return { ...state, errors: {} };
    case "RESET":
      return initialState;
    case "RESTORE_STATE":
      return action.payload;
    default:
      return state;
  }
}

// Context
interface OnboardingContextValue {
  state: OnboardingState;
  setStep: (step: number) => void;
  setDemographics: (data: DemographicsData) => void;
  setGoals: (data: GoalsData) => void;
  setPreferences: (data: PreferencesData) => void;
  addFamilyMember: (data: FamilyMemberData) => void;
  updateFamilyMember: (index: number, data: FamilyMemberData) => void;
  removeFamilyMember: (index: number) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (field: string, message: string) => void;
  clearErrors: () => void;
  reset: () => void;
  canGoToStep: (step: number) => boolean;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

// Local storage key
const STORAGE_KEY = "DietAIbook_onboarding_state";

// Provider component
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);

  // Load state from local storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          dispatch({ type: "RESTORE_STATE", payload: parsed });
        }
      } catch (error) {
        console.error("Failed to restore onboarding state:", error);
      }
    }
  }, []);

  // Save state to local storage on changes
  useEffect(() => {
    if (typeof window !== "undefined" && !state.isSubmitting) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.error("Failed to save onboarding state:", error);
      }
    }
  }, [state]);

  // Action creators
  const setStep = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const setDemographics = useCallback((data: DemographicsData) => {
    dispatch({ type: "SET_DEMOGRAPHICS", payload: data });
  }, []);

  const setGoals = useCallback((data: GoalsData) => {
    dispatch({ type: "SET_GOALS", payload: data });
  }, []);

  const setPreferences = useCallback((data: PreferencesData) => {
    dispatch({ type: "SET_PREFERENCES", payload: data });
  }, []);

  const addFamilyMember = useCallback((data: FamilyMemberData) => {
    dispatch({ type: "ADD_FAMILY_MEMBER", payload: data });
  }, []);

  const updateFamilyMember = useCallback(
    (index: number, data: FamilyMemberData) => {
      dispatch({ type: "UPDATE_FAMILY_MEMBER", payload: { index, data } });
    },
    []
  );

  const removeFamilyMember = useCallback((index: number) => {
    dispatch({ type: "REMOVE_FAMILY_MEMBER", payload: index });
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    dispatch({ type: "SET_SUBMITTING", payload: isSubmitting });
  }, []);

  const setError = useCallback((field: string, message: string) => {
    dispatch({ type: "SET_ERROR", payload: { field, message } });
  }, []);

  const clearErrors = useCallback(() => {
    dispatch({ type: "CLEAR_ERRORS" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Failed to clear onboarding state:", error);
      }
    }
  }, []);

  // Check if user can navigate to a specific step
  const canGoToStep = useCallback(
    (step: number) => {
      if (step === 0) return true;
      if (step === 1) return state.demographics !== null;
      if (step === 2)
        return state.demographics !== null && state.goals !== null;
      return false;
    },
    [state.demographics, state.goals]
  );

  const value: OnboardingContextValue = {
    state,
    setStep,
    setDemographics,
    setGoals,
    setPreferences,
    addFamilyMember,
    updateFamilyMember,
    removeFamilyMember,
    setSubmitting,
    setError,
    clearErrors,
    reset,
    canGoToStep,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

// Hook to use onboarding context
export function useOnboardingState() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error(
      "useOnboardingState must be used within OnboardingProvider"
    );
  }
  return context;
}
