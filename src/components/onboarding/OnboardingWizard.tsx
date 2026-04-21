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
import { PageContainer } from "@/components/ui/page-container";

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
      const result = await completeOnboarding({
        demographics: state.demographics,
        goals: state.goals,
        preferences: state.preferences,
        familyMembers: state.familyMembers,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success("Your profile has been created successfully!");

      // Clear the onboarding state
      reset();

      // Redirect to dashboard
      router.push("/dashboard");
    } catch {
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
        return <PreferencesStep onFinish={handleFinish} isSubmitting={state.isSubmitting} />;
      default:
        return <DemographicsStep />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageContainer>
        <div className="max-w-3xl mx-auto">
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
      </PageContainer>
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
