import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import SocialProofStrip from "@/components/landing/SocialProofStrip";
import HowItWorks from "@/components/landing/HowItWorks";
import FeatureGrid from "@/components/landing/FeatureGrid";
import SpeedComparison from "@/components/landing/SpeedComparison";
import ShowcaseSection from "@/components/landing/ShowcaseSection";
import Testimonials from "@/components/landing/Testimonials";
import PricingTeaser from "@/components/landing/PricingTeaser";
import FAQSection from "@/components/landing/FAQSection";
import FooterCTA from "@/components/landing/FooterCTA";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <SocialProofStrip />
      <HowItWorks />
      <FeatureGrid />
      <SpeedComparison />
      <ShowcaseSection />
      <Testimonials />
      <PricingTeaser />
      <FAQSection />
      <FooterCTA />
    </div>
  );
};

export default Index;
