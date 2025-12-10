import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

export default async function OnboardingPage() {
  // Check if user is authenticated
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/sign-in");
  }

  // TODO: Check if user has already completed onboarding
  // const profile = await getUserProfile(session.user.id);
  // if (profile?.onboardingCompleted) {
  //   redirect("/dashboard");
  // }

  return <OnboardingWizard />;
}
