import type { Metadata } from "next";
import {
  FAQSection,
  FeaturesSection,
  FinalCTASection,
  HeroSection,
  HowItWorks,
  LandingFooter,
  LandingNav,
  LandingShell,
  PricingSection,
  // QuoteSection,
  // StatsStrip,
} from "@/components/landing";
import { buildLandingMetadata } from "@/components/landing/metadata";

interface LandingPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: LandingPageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildLandingMetadata(locale);
}

export default function LandingPage() {
  return (
    <LandingShell>
      <LandingNav />
      <main>
        <HeroSection />
        <HowItWorks />
        <FeaturesSection />
        {/* Enable only with real data: verifiable figures and a real, consented
            customer quote. Both take their content via props.
            <StatsStrip stats={[{ value: "…", label: "…" }]} />
            <QuoteSection quote="…" attribution="…" /> */}
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </LandingShell>
  );
}
