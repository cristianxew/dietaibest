import {
  LandingLayout,
  LandingNav,
  LandingFooter,
  AgentSidebar,
  HeroSection,
  FeaturesGrid,
  HowItWorks,
  PricingSection,
} from "@/components/landing";

export default function LandingPage() {
  return (
    <>
      <LandingLayout>
        {/* Navigation */}
        <LandingNav />

        {/* Content */}
        <div className="flex-1 z-10 relative">
          {/* Hero Section */}
          <HeroSection />

          {/* Features Grid */}
          <FeaturesGrid />

          {/* How It Works */}
          <HowItWorks />

          {/* Pricing */}
          <PricingSection />
        </div>

        {/* Footer */}
        <LandingFooter />
      </LandingLayout>

      {/* Agent Sidebar Demo */}
      <AgentSidebar />
    </>
  );
}
