import {
  LandingLayout,
  LandingNav,
  LandingFooter,
  AgentSidebar,
  HeroSection,
  // ProblemSection,
  FeaturesGrid,
  // HowItWorks,
  // TestimonialsSection,
  // PricingSection,
  // FAQSection,
  FinalCTASection,
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

          {/* Testimonials */}
          {/* <TestimonialsSection /> */}

          {/* Final CTA */}
          <FinalCTASection />

          {/* Commented out — available if needed:
          <ProblemSection />
          <HowItWorks />
          <PricingSection />
          <FAQSection />
          */}
        </div>

        {/* Footer */}
        <LandingFooter />
      </LandingLayout>

      {/* Agent Sidebar Demo */}
      <AgentSidebar />
    </>
  );
}
