import React from 'react';
import HeroSection from '../components/HeroSection.jsx';
import QuickEligibilityChecker from '../components/QuickEligibilityChecker.jsx';
import FeaturedScholarships from '../components/FeaturedScholarships.jsx';
import ProviderCTA from '../components/ProviderCTA.jsx';
import FAQSection from '../components/FAQSection.jsx';
import ContactUs from '../components/ContactUs.jsx'

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <QuickEligibilityChecker />
      <FeaturedScholarships/>
      <ProviderCTA/>
      <FAQSection />
      <ContactUs/>
    </div>
  );
}