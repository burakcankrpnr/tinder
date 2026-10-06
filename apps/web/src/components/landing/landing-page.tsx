import { AstrologySection } from './astrology-section';
import { DoubleDateSection } from './double-date-section';
import { DownloadBand } from './download-band';
import { EventsSection } from './events-section';
import { FaqBand } from './faq-band';
import { FeaturesSection } from './features-section';
import { GiftsSection } from './gifts-section';
import { Hero } from './hero';
import { LandingFrame } from './landing-frame';
import { MissionSection } from './mission-section';
import { MusicSection } from './music-section';
import { SafetySection } from './safety-section';
import { SubscriptionsSection } from './subscriptions-section';
import { SupportSection } from './support-section';
import { WhySection } from './why-section';

export function LandingPage() {
  return (
    <LandingFrame>
      <Hero />
      <FeaturesSection />
      <MissionSection />
      <DoubleDateSection />
      <AstrologySection />
      <MusicSection />
      <SafetySection />
      <WhySection />
      <FaqBand />
      <DownloadBand />
      <SubscriptionsSection />
      <SupportSection />
      <GiftsSection />
      <EventsSection />
    </LandingFrame>
  );
}
