"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useOnboardingState,
  OnboardingProvider,
} from "./hooks/useOnboardingState";
import { ProgressIndicator } from "./components/ProgressIndicator";
import { DemographicsStep } from "./steps/DemographicsStep";
import { GoalsStep } from "./steps/GoalsStep";
import { PreferencesStep } from "./steps/PreferencesStep";
import { ONBOARDING_STEPS } from "./steps";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeOnboarding } from "@/actions/onboarding";

function OnboardingWizardContent() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const { state, setStep, canGoToStep, setSubmitting, reset } =
    useOnboardingState();

  const handleStepClick = (stepIndex: number) => {
    if (canGoToStep(stepIndex)) {
      setStep(stepIndex);
    }
  };

  const handleFinish = async () => {
    if (!state.demographics || !state.goals || !state.preferences) {
      toast.error("Please complete all required steps before finishing.");
      return;
    }

    setSubmitting(true);

    try {
      // Call server action to save onboarding data
      console.log("OnboardingWizard - Starting completion with data:", {
        demographics: state.demographics,
        goals: state.goals,
        preferences: state.preferences,
        familyMembers: state.familyMembers,
      });

      const result = await completeOnboarding({
        demographics: state.demographics,
        goals: state.goals,
        preferences: state.preferences,
        familyMembers: state.familyMembers,
      });

      console.log("OnboardingWizard - Server response:", result);

      if (result.error) {
        console.error(
          "OnboardingWizard - Server returned error:",
          result.error
        );
        throw new Error(result.error);
      }

      console.log("OnboardingWizard - Success! Profile created:", result.data);
      toast.success("Your profile has been created successfully!");

      // Clear the onboarding state
      reset();

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error) {
      console.error("OnboardingWizard - Caught error:", error);
      toast.error("Failed to complete onboarding. Please try again.");
      setSubmitting(false);
    }
  };

  // Remove the automatic finish logic that was causing infinite loops

  const renderStep = () => {
    switch (state.currentStep) {
      case 0:
        return <DemographicsStep />;
      case 1:
        return <GoalsStep />;
      case 2:
        return <PreferencesStep onFinish={handleFinish} />;
      default:
        return <DemographicsStep />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto py-8 px-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">{t("title")}</CardTitle>
            <CardDescription className="text-lg">
              {t("subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProgressIndicator
              currentStep={state.currentStep}
              steps={ONBOARDING_STEPS.map((step) => ({
                ...step,
                title: t(`steps.${step.id}.title`),
              }))}
              onStepClick={handleStepClick}
              canNavigateToStep={canGoToStep}
            />

            <div className="mt-8">{renderStep()}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function OnboardingWizard() {
  return (
    <OnboardingProvider>
      <OnboardingWizardContent />
    </OnboardingProvider>
  );
}
