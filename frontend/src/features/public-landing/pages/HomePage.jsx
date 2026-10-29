import HeroSection from '../components/HeroSection.jsx';
import QuickEligibilityChecker from '../components/QuickEligibilityChecker.jsx';
import ProviderCTA from '../components/ProviderCTA.jsx';
import FAQSection from '../components/FAQSection.jsx';
import ContactUs from '../components/ContactUs.jsx'

export default function HomePage() {
  return (
    <div>
      <HeroSection />
      <QuickEligibilityChecker />
      <ProviderCTA/>
      <FAQSection />
      <ContactUs/>
    </div>
  );
}