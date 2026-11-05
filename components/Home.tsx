import React, { lazy, Suspense } from 'react';
import { useAuth } from '../context/AuthContext';
import { PWAPrompt } from './PWAPrompt';
import { WatchLive } from './WatchLive';
import { MinistriesSection } from './MinistriesSection';
import { UpcomingEvents } from './UpcomingEvents';
import { ConnectHub } from './ConnectHub';
import { ConnectCard } from './ConnectCard';
import { Announcements } from './Announcements';
import { PrayerWall } from './PrayerWall';
import { Footer } from './Footer';
import { LoadingState } from './ui/States';
import { SeasonHeroLayer } from './season/SeasonHeroLayer';
import { HomeHero } from './home/HomeHero';
import { HomeHubGrid } from './home/HomeHubGrid';
import { VisitorWelcomeStrip } from './home/VisitorWelcomeStrip';
import { HolidayRsvpCard } from './home/HolidayRsvpCard';

const MemberHome = lazy(() =>
  import('./member/MemberHome').then((m) => ({ default: m.MemberHome }))
);

/** Public / visitor / pending Home — Sanctuary wine shell + the existing feed on a cream sheet. */
export const PublicHome: React.FC = () => (
  <div className="awc-home-shell">
    <SeasonHeroLayer />
    <HomeHero variant="public" />
    <PWAPrompt />

    <div className="relative px-5 pt-6 pb-2">
      <HomeHubGrid variant="public" />
    </div>

    <main className="relative mt-7 bg-cream text-ink rounded-t-[30px] px-5 pt-5 space-y-12 pb-[calc(8.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(0,0,0,0.22)]">
      <div className="mx-auto h-1 w-10 rounded-full bg-[#D8CCBF]" aria-hidden />
      <h2 className="!mt-3 font-display text-[22px] font-bold text-ink">🗓️ This week at PLCC</h2>
      <HolidayRsvpCard />
      <VisitorWelcomeStrip />

      <section id="announcements" className="scroll-mt-24">
        <Announcements />
      </section>

      <section id="watch-live" className="scroll-mt-24">
        <WatchLive />
      </section>

      <section id="ministries" className="scroll-mt-24">
        <MinistriesSection />
      </section>

      <section id="events" className="scroll-mt-24">
        <UpcomingEvents />
      </section>

      <section id="connect-hub" className="scroll-mt-24">
        <ConnectHub />
      </section>

      <section id="prayer-wall" className="scroll-mt-24">
        <PrayerWall />
      </section>

      <section id="connect" className="scroll-mt-24">
        <ConnectCard />
      </section>

      <Footer />
    </main>
  </div>
);

/**
 * Home switch:
 * - approved_member → My PLCC Home (Phase 2.1)
 * - visitor / pending / unverified → public Home (no Community preview)
 */
export const Home: React.FC = () => {
  const { memberAccessState } = useAuth();

  if (memberAccessState === 'approved_member') {
    return (
      <Suspense
        fallback={
          <main className="px-5 pt-16 pb-28">
            <LoadingState message="Loading your home…" />
          </main>
        }
      >
        <MemberHome />
      </Suspense>
    );
  }

  return <PublicHome />;
};
