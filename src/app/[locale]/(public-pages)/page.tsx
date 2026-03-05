import {
  LandingLayout,
  LandingNav,
  LandingFooter,
  AgentSidebar,
  HeroSection,
  ProblemSection,
  FeaturesGrid,
  HowItWorks,
  TestimonialsSection,
  PricingSection,
  FAQSection,
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

          {/* Problem Section */}
          <ProblemSection />

          {/* Features Grid */}
          <FeaturesGrid />

          {/* How It Works */}
          <HowItWorks />

          {/* Testimonials */}
          <TestimonialsSection />

          {/* FAQ */}
          <FAQSection />

          {/* Final CTA */}
          <FinalCTASection />

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
