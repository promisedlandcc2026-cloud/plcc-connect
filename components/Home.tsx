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

/** Public / visitor / pending Home — PLCC Tribes: forest bar, woven welcome, ivory feed. */
export const PublicHome: React.FC = () => (
  <div className="tribes-home">
    <SeasonHeroLayer />
    <HomeHero variant="public" />
    <PWAPrompt />

    <div className="relative px-5 pt-6 pb-2">
      <HomeHubGrid variant="public" />
    </div>

    <main className="relative text-ink px-5 pt-8 space-y-12 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <div>
        <h2 className="font-display text-[26px] font-semibold text-[#12231c]">This week at PLCC</h2>
        <span aria-hidden className="mt-2.5 block h-[3px] w-10 rounded-full bg-[#C9A35A]" />
      </div>
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
